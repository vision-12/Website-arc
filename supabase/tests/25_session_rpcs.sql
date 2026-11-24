begin;
select plan(10);
create temp table u on commit drop as select
  tests.create_user('ce@example.test', 'content_editor') as ce,
  tests.create_user('ao@example.test', 'admissions_officer') as ao,
  tests.create_user('new@example.test', 'read_only_staff', 'invited') as invited,
  tests.create_user('gone@example.test', 'content_editor', 'deactivated') as gone;
grant select on u to authenticated, anon;

select tests.authenticate_as((select ce from u));
select ok((public.my_access() -> 'permissions') ? 'pages.create', 'my_access lists granted permissions');
select ok(not ((public.my_access() -> 'permissions') ? 'admissions.view'), 'my_access omits permissions not granted');
select is((public.my_access() ->> 'requiresMfa')::boolean, false, 'content editor does not require MFA');
select public.record_login();
select tests.as_system();
select isnt((select last_login_at from public.profiles where id = (select ce from u)), null, 'record_login stamps last_login_at');
select is((select count(*)::int from public.activity_logs where action = 'auth.login' and actor_id = (select ce from u)), 1,
  'record_login writes an audit entry');

select tests.authenticate_as((select ao from u));
select is((public.my_access() ->> 'requiresMfa')::boolean, true, 'admissions officer requires MFA');
select tests.as_system();

select tests.authenticate_as((select gone from u));
select is(jsonb_array_length(public.my_access() -> 'permissions'), 0, 'a deactivated account has no permissions');
select tests.as_system();

select tests.authenticate_as((select invited from u));
select lives_ok($$select public.accept_invite('New Teacher')$$, 'an invited user can accept once');
select throws_ok($$select public.accept_invite('Again')$$, '42501', 'FORBIDDEN', 'an invitation cannot be accepted twice');
select tests.as_system();

select tests.as_anon();
select throws_ok(format($$select public.revoke_user_sessions(%L)$$, (select ce from u)), '42501', null,
  'only the service role can revoke sessions');

select * from finish();
rollback;
