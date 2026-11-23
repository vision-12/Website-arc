begin;
select plan(11);

create temp table u on commit drop as select
  tests.create_user('sa@example.test', 'super_admin') as sa,
  tests.create_user('adm@example.test', 'school_admin') as adm,
  tests.create_user('ht@example.test', 'headteacher') as ht,
  tests.create_user('ce@example.test', 'content_editor') as ce,
  tests.create_user('new@example.test') as newbie;
grant select on u to authenticated;
-- Make the test's super admin the only active one (the local seed adds another).
update public.profiles set status = 'deactivated'
where id <> (select sa from u)
  and id in (select ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.key = 'super_admin');

-- School administrator (holds users.manage, not users.manage_roles)
select tests.authenticate_as((select adm from u));
select throws_ok(format($$insert into public.user_roles (user_id, role_id, granted_by)
  select %L, id, %L from public.roles where key = 'super_admin'$$, (select adm from u), (select adm from u)),
  '42501', null, 'nobody can grant a role to themselves');
select throws_ok(format($$insert into public.user_roles (user_id, role_id, granted_by)
  select %L, id, %L from public.roles where key = 'super_admin'$$, (select newbie from u), (select adm from u)),
  '42501', 'ESCALATION_DENIED', 'a school admin cannot grant super admin (permissions they do not hold)');
select lives_ok(format($$insert into public.user_roles (user_id, role_id, granted_by)
  select %L, id, %L from public.roles where key = 'content_editor'$$, (select newbie from u), (select adm from u)),
  'a school admin can grant a role whose permissions they hold');
select throws_ok($$insert into public.roles (key, name) values ('my_role', 'Mine')$$, '42501', null,
  'creating roles needs users.manage_roles');
select tests.as_system();

-- Headteacher cannot grant school admin (school admin holds settings.manage, which HT lacks)
select tests.authenticate_as((select ht from u));
select throws_ok(format($$insert into public.user_roles (user_id, role_id, granted_by)
  select %L, id, %L from public.roles where key = 'school_admin'$$, (select newbie from u), (select ht from u)),
  '42501', 'ESCALATION_DENIED', 'headteacher cannot grant school administrator');
select tests.as_system();

-- Content editor cannot change their own status or anyone's roles
select tests.authenticate_as((select ce from u));
select lives_ok($$update public.profiles set full_name = 'Renamed' where id = (select auth.uid())$$, 'users may rename themselves');
select throws_ok($$update public.profiles set status = 'deactivated' where id = (select auth.uid())$$, '42501', null,
  'users cannot change their own status');
select tests.as_system();

-- Super admin: system roles are immutable; the last active super admin is protected (MP §6)
select tests.authenticate_as((select sa from u), 'aal2');
update public.roles set name = 'Hacked' where key = 'content_editor';
select is((select name from public.roles where key = 'content_editor'), 'Content Editor', 'system roles cannot be renamed');
select throws_ok(format($$delete from public.user_roles where user_id = %L
  and role_id = (select id from public.roles where key = 'super_admin')$$, (select sa from u)),
  'P0001', 'LAST_SUPER_ADMIN', 'the last super admin cannot be demoted');
select throws_ok(format($$update public.profiles set status = 'deactivated' where id = %L$$, (select sa from u)),
  'P0001', 'LAST_SUPER_ADMIN', 'the last super admin cannot be deactivated');
select lives_ok($$insert into public.roles (key, name) values ('custom_role', 'Custom role')$$, 'super admin can create custom roles');

select * from finish();
rollback;
