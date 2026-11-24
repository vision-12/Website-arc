begin;
select plan(3);
create temp table u on commit drop as select
  tests.create_user('adm@example.test', 'school_admin') as adm,
  tests.create_user('ce@example.test', 'content_editor') as ce;
grant select on u to authenticated;

select tests.authenticate_as((select adm from u));
select throws_ok(format($$insert into public.auth_admin_jobs (op, payload, requested_by)
  values ('invite', jsonb_build_object('email', 'x@example.test', 'full_name', 'X', 'role_ids',
    jsonb_build_array((select id from public.roles where key = 'super_admin'))), %L)$$, (select adm from u)),
  '42501', 'ESCALATION_DENIED', 'an invite cannot carry a role the inviter could not grant');
select lives_ok(format($$insert into public.auth_admin_jobs (op, payload, requested_by)
  values ('invite', jsonb_build_object('email', 'x@example.test', 'full_name', 'X', 'role_ids',
    jsonb_build_array((select id from public.roles where key = 'content_editor'))), %L)$$, (select adm from u)),
  'a school admin can invite a content editor');
select tests.as_system();

select tests.authenticate_as((select ce from u));
select throws_ok(format($$insert into public.auth_admin_jobs (op, payload, requested_by)
  values ('sign_out', '{}', %L)$$, (select ce from u)), '42501', null, 'creating auth jobs needs users.manage');

select * from finish();
rollback;
