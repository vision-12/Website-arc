-- Role, permission and account-status changes reach the audit log with the acting user
-- (MP §12 DoD "audit entries for logins and role changes"; sign-ins are covered by 25_session_rpcs).
begin;
select plan(4);

create temp table u on commit drop as select
  tests.create_user('sa@example.test', 'super_admin') as sa,
  tests.create_user('adm@example.test', 'school_admin') as adm,
  tests.create_user('newbie@example.test') as newbie,
  tests.create_user('ce@example.test', 'content_editor') as ce;
grant select on u to authenticated;

-- A school administrator grants a role, removes it again, then deactivates a colleague.
select tests.authenticate_as((select adm from u));
insert into public.user_roles (user_id, role_id, granted_by)
  select (select newbie from u), id, (select adm from u) from public.roles where key = 'content_editor';
delete from public.user_roles
  where user_id = (select newbie from u) and role_id = (select id from public.roles where key = 'content_editor');
update public.profiles set status = 'deactivated' where id = (select ce from u);
select tests.as_system();

-- A super administrator builds a custom role.
select tests.authenticate_as((select sa from u), 'aal2');
insert into public.roles (key, name) values ('audit_custom', 'Audit custom');
insert into public.role_permissions (role_id, permission_key)
  select id, 'pages.view' from public.roles where key = 'audit_custom';
select tests.as_system();

select is(
  (select count(*)::int from public.activity_logs
    where action = 'users.role_granted' and actor_id = (select adm from u)
      and entity_id = (select newbie from u)::text and metadata ->> 'role' = 'content_editor'),
  1, 'granting a role is audited: who did it, to whom, which role');
select is(
  (select count(*)::int from public.activity_logs
    where action = 'users.role_removed' and actor_id = (select adm from u)
      and entity_id = (select newbie from u)::text and metadata ->> 'role' = 'content_editor'),
  1, 'removing a role is audited');
select is(
  (select metadata from public.activity_logs
    where action = 'users.status_changed' and actor_id = (select adm from u)
      and entity_id = (select ce from u)::text),
  '{"from": "active", "to": "deactivated"}'::jsonb,
  'deactivating an account is audited with the old and new status');
select is(
  (select count(*)::int from public.activity_logs
    where action = 'roles.permission_added' and actor_id = (select sa from u)
      and metadata ->> 'permission' = 'pages.view'),
  1, 'adding a permission to a role is audited');

select * from finish();
rollback;
