-- Session-level RPCs for the app (Phase 2): one permission core, the caller's access summary,
-- login bookkeeping, accepting an invite, and service-only session revocation (spec §2.4, §4.4, §4.7).

-- The permission rule, parameterised by user. has_permission() is the caller-bound wrapper.
create or replace function private.permission_check(p_user uuid, p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null
     and exists (select 1 from public.profiles pr where pr.id = p_user and pr.status = 'active')
     and (
       exists (
         select 1
         from public.user_roles ur
         join public.role_permissions rp on rp.role_id = ur.role_id
         join public.roles r on r.id = ur.role_id
         join public.permissions pm on pm.key = rp.permission_key
         where ur.user_id = p_user and rp.permission_key = p
           and not (r.key = 'platform_support' and pm.is_sensitive)
       )
       or exists (
         select 1 from public.support_access_grants g
         where g.grantee_id = p_user and p = any (g.permission_keys)
           and g.revoked_at is null and now() between g.starts_at and g.expires_at
       )
     )
$$;
revoke all on function private.permission_check(uuid, text) from public, anon, authenticated;

create or replace function public.has_permission(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.permission_check((select auth.uid()), p)
$$;

-- For the privileged-auth job runner (service role): re-check the requester at execution time (D13).
create or replace function public.user_has_permission(p_user uuid, p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.permission_check(p_user, p)
$$;
revoke all on function public.user_has_permission(uuid, text) from public, anon, authenticated;
grant execute on function public.user_has_permission(uuid, text) to service_role;

-- Everything the admin shell needs about the caller in one round trip. Cosmetic only: every
-- action re-checks on the server and RLS is the authority.
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p.id is null then null else jsonb_build_object(
    'userId', p.id,
    'fullName', p.full_name,
    'email', p.email,
    'status', p.status,
    'mfaEnrolled', p.mfa_enrolled,
    'requiresMfa', private.user_requires_mfa() or private.feature_enabled('mfaRequiredForAdmins'),
    'isPlatformSupport', exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                                 where ur.user_id = p.id and r.key = 'platform_support'),
    'roles', coalesce((select jsonb_agg(r.name order by r.name) from public.user_roles ur
                       join public.roles r on r.id = ur.role_id where ur.user_id = p.id), '[]'),
    'permissions', coalesce((select jsonb_agg(pm.key order by pm.key) from public.permissions pm
                             where private.permission_check(p.id, pm.key)), '[]'),
    'sensitivePermissions', coalesce((select jsonb_agg(pm.key order by pm.key) from public.permissions pm
                                      where pm.is_sensitive), '[]')
  ) end
  from (select 1) one
  left join public.profiles p on p.id = (select auth.uid())
$$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

create or replace function public.record_login()
returns void language plpgsql security definer set search_path = '' as $$
declare v_found boolean;
begin
  perform set_config('app.trusted_rpc', 'on', true);
  update public.profiles set last_login_at = now() where id = (select auth.uid()) and status = 'active';
  v_found := found;
  perform set_config('app.trusted_rpc', 'off', true);
  if v_found then
    insert into public.activity_logs (source, actor_id, actor_label, action, entity_type, entity_id, summary)
    select 'app', p.id, p.full_name, 'auth.login', 'profile', p.id::text, 'Signed in'
    from public.profiles p where p.id = (select auth.uid());
  end if;
end $$;
revoke all on function public.record_login() from public, anon;
grant execute on function public.record_login() to authenticated;

create or replace function public.accept_invite(p_full_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_found boolean;
begin
  if char_length(trim(coalesce(p_full_name, ''))) not between 2 and 120 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  perform set_config('app.trusted_rpc', 'on', true);
  update public.profiles set status = 'active', full_name = trim(p_full_name)
  where id = (select auth.uid()) and status = 'invited';
  v_found := found;
  perform set_config('app.trusted_rpc', 'off', true);
  if not v_found then
    raise exception 'FORBIDDEN' using errcode = '42501', detail = 'This invitation has already been used.';
  end if;
  insert into public.activity_logs (source, actor_id, actor_label, action, entity_type, entity_id, summary)
  values ('app', (select auth.uid()), trim(p_full_name), 'auth.invite_accepted', 'profile', (select auth.uid())::text,
          'Accepted the invitation and set a password');
end $$;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- Ends every session of a user (used when an account is deactivated, MP §6). Refresh tokens are
-- removed with their sessions; access tokens expire within jwt_expiry, and has_permission() already
-- refuses deactivated accounts immediately.
create or replace function public.revoke_user_sessions(p_user uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  delete from auth.sessions where user_id = p_user;
  get diagnostics v = row_count;
  return v;
end $$;
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
