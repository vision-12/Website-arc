-- Append-only activity log (spec §1.11, MP §7.7).

create table public.activity_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  source public.log_source not null,
  actor_id uuid,                -- no FK: logs outlive accounts
  actor_label text,
  action text not null check (char_length(action) between 3 and 80),
  entity_type text,
  entity_id text,
  summary text,
  diff jsonb,
  metadata jsonb,
  ip_hash text
);
create index activity_logs_occurred_idx on public.activity_logs (occurred_at desc);
create index activity_logs_actor_idx on public.activity_logs (actor_id, occurred_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);
create index activity_logs_action_idx on public.activity_logs (action);

create trigger activity_logs_append_only before update or delete on public.activity_logs
  for each row execute function private.forbid_update_delete();

alter table public.activity_logs enable row level security;
create policy activity_logs_select on public.activity_logs for select to authenticated
  using ((select public.has_permission('activity.view')));
-- No insert/update/delete policies: rows arrive only through log_activity() and DB triggers.

-- Application-level audit entry. The actor is always the caller; it cannot be supplied.
create or replace function public.log_activity(
  p_action text, p_summary text,
  p_entity_type text default null, p_entity_id text default null,
  p_diff jsonb default null, p_metadata jsonb default null, p_ip_hash text default null
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_label text;
begin
  select full_name into v_label from public.profiles where id = (select auth.uid()) and status = 'active';
  if v_label is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  insert into public.activity_logs (source, actor_id, actor_label, action, entity_type, entity_id, summary, diff, metadata, ip_hash)
  values ('app', (select auth.uid()), v_label, p_action, p_entity_type, p_entity_id, left(p_summary, 500), p_diff, p_metadata, p_ip_hash)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.log_activity(text, text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.log_activity(text, text, text, text, jsonb, jsonb, text) to authenticated, service_role;

-- Tamper-resistant DB-sourced entries for sensitive changes (spec §1.13).
create or replace function private.audit_sensitive_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_label text := (select full_name from public.profiles where id = v_actor);
  v_action text;
  v_entity text;
  v_meta jsonb;
begin
  case tg_table_name
    when 'user_roles' then
      v_action := case tg_op when 'INSERT' then 'users.role_granted' else 'users.role_removed' end;
      v_entity := coalesce(new.user_id, old.user_id)::text;
      v_meta := jsonb_build_object('role', (select key from public.roles where id = coalesce(new.role_id, old.role_id)));
    when 'role_permissions' then
      v_action := case tg_op when 'INSERT' then 'roles.permission_added' else 'roles.permission_removed' end;
      v_entity := coalesce(new.role_id, old.role_id)::text;
      v_meta := jsonb_build_object('permission', coalesce(new.permission_key, old.permission_key));
    when 'profiles' then
      v_action := 'users.status_changed';
      v_entity := new.id::text;
      v_meta := jsonb_build_object('from', old.status, 'to', new.status);
    when 'site_settings' then
      v_action := 'settings.updated';
      v_entity := 'site_settings';
      v_meta := jsonb_build_object('version', new.version);
    when 'support_access_grants' then
      v_action := case when tg_op = 'INSERT' then 'support.granted' else 'support.revoked' end;
      v_entity := new.id::text;
      v_meta := jsonb_build_object('grantee', new.grantee_id, 'permissions', new.permission_keys, 'expires_at', new.expires_at);
    else
      v_action := tg_table_name || '.' || lower(tg_op);
  end case;
  insert into public.activity_logs (source, actor_id, actor_label, action, entity_type, entity_id, metadata)
  values ('db', v_actor, v_label, v_action, tg_table_name, v_entity, v_meta);
  return null;
end $$;

create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function private.audit_sensitive_change();
create trigger role_permissions_audit after insert or delete on public.role_permissions
  for each row execute function private.audit_sensitive_change();
create trigger profiles_status_audit after update of status on public.profiles
  for each row when (old.status is distinct from new.status) execute function private.audit_sensitive_change();
create trigger support_grants_audit after insert or update on public.support_access_grants
  for each row execute function private.audit_sensitive_change();
