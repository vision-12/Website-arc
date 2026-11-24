-- Privileged auth operations as audited, two-step jobs (spec D13, decision P2-B).

create table public.auth_admin_jobs (
  id uuid primary key default gen_random_uuid(),
  op text not null check (op in ('invite', 'resend_invite', 'sign_out')),
  target_user_id uuid references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}',
  requested_by uuid references public.profiles (id) on delete set null,
  state text not null default 'pending' check (state in ('pending', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index auth_admin_jobs_target_idx on public.auth_admin_jobs (target_user_id);
create index auth_admin_jobs_requested_by_idx on public.auth_admin_jobs (requested_by);
create index auth_admin_jobs_pending_idx on public.auth_admin_jobs (state, created_at) where state = 'pending';

create or replace function private.guard_auth_admin_job()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_role uuid;
begin
  if not private.is_end_user() then return new; end if;
  new.requested_by := (select auth.uid());
  new.state := 'pending';
  new.error := null;
  new.completed_at := null;
  if new.op = 'invite' then
    if jsonb_typeof(new.payload -> 'role_ids') <> 'array' or jsonb_array_length(new.payload -> 'role_ids') = 0 then
      raise exception 'VALIDATION' using errcode = '22023', detail = 'An invitation needs at least one role.';
    end if;
    for v_role in select (jsonb_array_elements_text(new.payload -> 'role_ids'))::uuid loop
      if exists (select 1 from public.roles where id = v_role and key = 'platform_support')
         or not private.holds_all_permissions_of(v_role) then
        raise exception 'ESCALATION_DENIED' using errcode = '42501';
      end if;
    end loop;
  elsif new.target_user_id is not null then
    -- Acting on someone more privileged (e.g. signing out a super admin) is escalation too.
    if exists (select 1 from public.user_roles ur where ur.user_id = new.target_user_id
               and not private.holds_all_permissions_of(ur.role_id)) then
      raise exception 'ESCALATION_DENIED' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger auth_admin_jobs_guard before insert on public.auth_admin_jobs
  for each row execute function private.guard_auth_admin_job();

alter table public.auth_admin_jobs enable row level security;
create policy auth_admin_jobs_select on public.auth_admin_jobs for select to authenticated
  using ((select public.has_permission('users.view')));
create policy auth_admin_jobs_insert on public.auth_admin_jobs for insert to authenticated
  with check ((select public.has_permission('users.manage')) and requested_by = (select auth.uid()));
