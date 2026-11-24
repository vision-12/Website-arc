-- Identity, roles, permissions and the single permission check (spec §1.2, §2, §3.5; MP §6).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email extensions.citext not null unique,
  status public.profile_status not null default 'invited',
  last_login_at timestamptz,
  mfa_enrolled boolean not null default false,
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_status_idx on public.profiles (status);
create index profiles_deactivated_by_idx on public.profiles (deactivated_by);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]{3,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  description text,
  is_system boolean not null default false,
  requires_mfa boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index roles_created_by_idx on public.roles (created_by);

create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  module text not null,
  action text not null,
  description text not null,
  is_sensitive boolean not null default false
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);
create index role_permissions_permission_idx on public.role_permissions (permission_key);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index user_roles_role_idx on public.user_roles (role_id);
create index user_roles_granted_by_idx on public.user_roles (granted_by);

create table public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  grantee_id uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  permission_keys text[] not null check (cardinality(permission_keys) between 1 and 20),
  reason text not null check (char_length(reason) between 10 and 500),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at and expires_at <= starts_at + interval '7 days')
);
create index support_grants_grantee_idx on public.support_access_grants (grantee_id, expires_at);
create index support_grants_granted_by_idx on public.support_access_grants (granted_by);
create index support_grants_revoked_by_idx on public.support_access_grants (revoked_by);

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger roles_touch before update on public.roles for each row execute function private.touch_updated_at();

-- ── The single permission check (spec §2.4) ───────────────────────────────────
create or replace function public.has_permission(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
     and exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.status = 'active')
     and (
       exists (
         select 1
         from public.user_roles ur
         join public.role_permissions rp on rp.role_id = ur.role_id
         join public.roles r on r.id = ur.role_id
         join public.permissions pm on pm.key = rp.permission_key
         where ur.user_id = (select auth.uid())
           and rp.permission_key = p
           and not (r.key = 'platform_support' and pm.is_sensitive)
       )
       or exists (
         select 1 from public.support_access_grants g
         where g.grantee_id = (select auth.uid())
           and p = any (g.permission_keys)
           and g.revoked_at is null
           and now() between g.starts_at and g.expires_at
       )
     )
$$;
revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to anon, authenticated, service_role;

-- True when the caller holds every permission attached to the role (no granting what you lack).
create or replace function private.holds_all_permissions_of(p_role uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = p_role and not public.has_permission(rp.permission_key)
  )
$$;

create or replace function private.user_requires_mfa()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid()) and r.requires_mfa
  )
$$;
grant execute on function private.user_requires_mfa() to authenticated, service_role;

-- ── Profiles from auth users ──────────────────────────────────────────────────
-- Roles are NEVER read from user metadata (users can edit it); the invite job assigns them (D13).
create or replace function private.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), 120)
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.on_auth_user_created();

create or replace function private.on_auth_user_email_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function private.on_auth_user_email_changed();

create or replace function private.sync_mfa_enrolled()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles
  set mfa_enrolled = exists (select 1 from auth.mfa_factors f where f.user_id = v_user and f.status = 'verified')
  where id = v_user;
  return null;
end $$;
create trigger on_mfa_factor_change after insert or update or delete on auth.mfa_factors
  for each row execute function private.sync_mfa_enrolled();

-- ── Guards (enforced in SQL, MP §6) ───────────────────────────────────────────
create or replace function private.guard_role_grant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row public.user_roles := case when tg_op = 'DELETE' then old else new end;
  v_key text;
begin
  if not private.is_end_user() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select key into v_key from public.roles where id = v_row.role_id;
  -- Altrastate support access is provisioned by Altrastate, never granted from the school's admin UI.
  if v_key = 'platform_support' or not private.holds_all_permissions_of(v_row.role_id) then
    raise exception 'ESCALATION_DENIED' using errcode = '42501',
      detail = 'You can only give or remove roles whose permissions you hold yourself.';
  end if;
  if tg_op = 'INSERT' then
    new.granted_by := (select auth.uid());
    new.granted_at := now();
    return new;
  end if;
  return old;
end $$;
create trigger user_roles_guard before insert or delete on public.user_roles
  for each row execute function private.guard_role_grant();

create or replace function private.active_super_admins()
returns integer language sql stable security definer set search_path = '' as $$
  select count(distinct ur.user_id)::int
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id and r.key = 'super_admin'
  join public.profiles p on p.id = ur.user_id and p.status = 'active'
$$;

create or replace function private.guard_last_super_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_was_super boolean;
begin
  if tg_table_name = 'user_roles' then
    v_was_super := exists (select 1 from public.roles where id = old.role_id and key = 'super_admin');
    if v_was_super and exists (select 1 from public.profiles where id = old.user_id and status = 'active')
       and private.active_super_admins() = 0 then
      raise exception 'LAST_SUPER_ADMIN' using errcode = 'P0001',
        detail = 'At least one active Super Administrator must remain.';
    end if;
  else -- profiles status change
    if old.status = 'active' and new.status <> 'active' and private.active_super_admins() = 0
       and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                   where ur.user_id = new.id and r.key = 'super_admin') then
      raise exception 'LAST_SUPER_ADMIN' using errcode = 'P0001',
        detail = 'At least one active Super Administrator must remain.';
    end if;
  end if;
  return null;
end $$;
create trigger user_roles_last_super_admin after delete on public.user_roles
  for each row execute function private.guard_last_super_admin();
create trigger profiles_last_super_admin after update of status on public.profiles
  for each row execute function private.guard_last_super_admin();

-- Users may rename themselves; status changes need users.manage, and only over users whose roles the
-- actor could grant (no deactivating someone more privileged).
create or replace function private.profile_update_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- System context, or one of our own definer RPCs (record_login, accept_invite) that set this
  -- transaction-local flag around a single statement. API clients cannot call set_config.
  if not private.is_end_user() or current_setting('app.trusted_rpc', true) = 'on' then return new; end if;
  if new.id <> old.id or new.email <> old.email or new.mfa_enrolled <> old.mfa_enrolled
     or new.last_login_at is distinct from old.last_login_at then
    raise exception 'FORBIDDEN' using errcode = '42501', detail = 'These profile fields are managed by the system.';
  end if;
  if new.status <> old.status then
    if not public.has_permission('users.manage') or (
         new.id = (select auth.uid()) and not public.has_permission('users.manage_roles'))
       or exists (select 1 from public.user_roles ur where ur.user_id = new.id
                  and not private.holds_all_permissions_of(ur.role_id)) then
      raise exception 'FORBIDDEN' using errcode = '42501', detail = 'You cannot change this account''s status.';
    end if;
    if new.status = 'deactivated' then
      new.deactivated_at := now();
      new.deactivated_by := (select auth.uid());
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.profile_update_guard();

create or replace function private.guard_support_grant()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.grantee_id, new.permission_keys, new.reason, new.starts_at, new.expires_at)
       is distinct from (old.grantee_id, old.permission_keys, old.reason, old.starts_at, old.expires_at) then
      raise exception 'FORBIDDEN' using errcode = '42501', detail = 'A grant can only be revoked, not changed.';
    end if;
    if private.is_end_user() and new.revoked_at is not null and old.revoked_at is null then
      new.revoked_by := (select auth.uid());
    end if;
    return new;
  end if;
  if not exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = new.grantee_id and r.key = 'platform_support') then
    raise exception 'VALIDATION' using errcode = '22023', detail = 'Support access can only be granted to Altrastate support accounts.';
  end if;
  if exists (select 1 from unnest(new.permission_keys) k
             where not exists (select 1 from public.permissions p where p.key = k and p.is_sensitive)) then
    raise exception 'VALIDATION' using errcode = '22023', detail = 'Only personal-data permissions are granted this way.';
  end if;
  if private.is_end_user() then
    if not exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                   where ur.user_id = (select auth.uid()) and r.key = 'super_admin') then
      raise exception 'FORBIDDEN' using errcode = '42501', detail = 'Only a Super Administrator can grant support access.';
    end if;
    new.granted_by := (select auth.uid());
  end if;
  return new;
end $$;
create trigger support_grants_guard before insert or update on public.support_access_grants
  for each row execute function private.guard_support_grant();

-- ── RLS (spec §3.5) ───────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.support_access_grants enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.has_permission('users.view')));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.has_permission('users.manage')))
  with check (id = (select auth.uid()) or (select public.has_permission('users.manage')));

create policy roles_select on public.roles for select to authenticated using (true);
create policy roles_insert on public.roles for insert to authenticated
  with check ((select public.has_permission('users.manage_roles')) and not is_system);
create policy roles_update on public.roles for update to authenticated
  using ((select public.has_permission('users.manage_roles')) and not is_system)
  with check ((select public.has_permission('users.manage_roles')) and not is_system);
create policy roles_delete on public.roles for delete to authenticated
  using ((select public.has_permission('users.manage_roles')) and not is_system);

create policy permissions_select on public.permissions for select to authenticated using (true);

create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_insert on public.role_permissions for insert to authenticated
  with check (
    (select public.has_permission('users.manage_roles'))
    and not exists (select 1 from public.roles r where r.id = role_id and r.is_system)
    and public.has_permission(permission_key)
  );
create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using (
    (select public.has_permission('users.manage_roles'))
    and not exists (select 1 from public.roles r where r.id = role_id and r.is_system)
  );

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_permission('users.view')));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check ((select public.has_permission('users.manage')) and user_id <> (select auth.uid()));
create policy user_roles_delete on public.user_roles for delete to authenticated
  using ((select public.has_permission('users.manage')));

create policy support_grants_select on public.support_access_grants for select to authenticated
  using (grantee_id = (select auth.uid()) or (select public.has_permission('users.view')));
create policy support_grants_insert on public.support_access_grants for insert to authenticated
  with check ((select public.has_permission('users.manage_roles')));
create policy support_grants_update on public.support_access_grants for update to authenticated
  using ((select public.has_permission('users.manage_roles')))
  with check ((select public.has_permission('users.manage_roles')));
