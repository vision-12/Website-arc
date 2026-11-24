begin;
select plan(5);
select tests.seed_fixtures();
create temp table u on commit drop as select
  tests.create_user('ao@example.test', 'admissions_officer') as ao,
  tests.create_user('ht@example.test', 'headteacher') as ht;
grant select on u to authenticated;

-- Roles flagged requires_mfa (super_admin, admissions_officer) always need AAL2 for sensitive data (P2-E).
select tests.authenticate_as((select ao from u), 'aal1');
select is(tests.visible_rows('public.applications'), 0, 'admissions officer without MFA sees no applications');
select tests.as_system();
select tests.authenticate_as((select ao from u), 'aal2');
select is(tests.visible_rows('public.applications'), 1, 'admissions officer with MFA sees applications');
select tests.as_system();

-- Other roles: only when the school turns on features.mfaRequiredForAdmins.
select tests.authenticate_as((select ht from u), 'aal1');
select is(tests.visible_rows('public.applications'), 1, 'headteacher without MFA allowed while the school flag is off');
select tests.as_system();
select tests.set_feature('mfaRequiredForAdmins', true);
select tests.authenticate_as((select ht from u), 'aal1');
select is(tests.visible_rows('public.applications'), 0, 'with the school flag on, aal1 is refused');
select tests.as_system();
select tests.authenticate_as((select ht from u), 'aal2');
select is(tests.visible_rows('public.applications'), 1, 'with the school flag on, aal2 is allowed');

select * from finish();
rollback;
