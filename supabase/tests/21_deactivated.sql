begin;
select plan(5);
select tests.seed_fixtures();
create temp table u on commit drop as select tests.create_user('gone@example.test', 'super_admin', 'deactivated') as id;
-- a second, active super admin so the deactivated one is not the last
select tests.create_user('boss@example.test', 'super_admin');
grant select on u to authenticated;

select tests.authenticate_as((select id from u), 'aal2');
select is((select count(*)::int from public.permissions p where public.has_permission(p.key)), 0,
  'a deactivated user holds no permission at all');
select is(tests.visible_rows('public.applications'), 0, 'deactivated user reads no applications');
select is(tests.visible_rows('public.activity_logs'), 0, 'deactivated user reads no logs');
select is(tests.visible_rows('public.pages'), 1, 'deactivated user sees only what the public sees');
select throws_ok($$insert into public.pages (title, slug) values ('x', 'x')$$, '42501', null, 'deactivated user cannot write');

select * from finish();
rollback;
