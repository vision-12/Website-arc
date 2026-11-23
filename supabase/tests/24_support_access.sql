begin;
select plan(7);
select tests.seed_fixtures();
create temp table u on commit drop as select
  tests.create_user('sa@example.test', 'super_admin') as sa,
  tests.create_user('adm@example.test', 'school_admin') as adm,
  tests.create_user('ps@example.test', 'platform_support') as ps,
  tests.create_user('ps2@example.test', 'platform_support') as ps2;
grant select on u to authenticated;

select tests.authenticate_as((select ps from u));
select ok(not public.has_permission('admissions.view'), 'platform support has no personal-data permission by default');
select is(tests.visible_rows('public.applications'), 0, 'platform support cannot read applications by default');
select ok(public.has_permission('settings.view'), 'platform support keeps technical permissions');
select tests.as_system();

select tests.authenticate_as((select adm from u));
select throws_ok(format($$insert into public.support_access_grants (grantee_id, granted_by, permission_keys, reason, expires_at)
  values (%L, %L, '{admissions.view}', 'Investigating an upload problem', now() + interval '2 hours')$$, (select ps from u), (select adm from u)),
  '42501', null, 'only a super admin can grant support access');
select tests.as_system();

select tests.authenticate_as((select sa from u), 'aal2');
select lives_ok(format($$insert into public.support_access_grants (grantee_id, granted_by, permission_keys, reason, expires_at)
  values (%L, %L, '{admissions.view}', 'Investigating an upload problem', now() + interval '2 hours')$$, (select ps from u), (select sa from u)),
  'super admin grants time-boxed support access');
select tests.as_system();

select tests.authenticate_as((select ps from u));
select is(tests.visible_rows('public.applications'), 1, 'during the grant, support can read applications');
select tests.as_system();

-- An expired grant gives nothing.
insert into public.support_access_grants (grantee_id, granted_by, permission_keys, reason, starts_at, expires_at)
  values ((select ps2 from u), (select sa from u), '{admissions.view}', 'Old investigation', now() - interval '3 hours', now() - interval '1 hour');
select tests.authenticate_as((select ps2 from u));
select is(tests.visible_rows('public.applications'), 0, 'an expired grant gives no access');

select * from finish();
rollback;
