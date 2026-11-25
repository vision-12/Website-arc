begin;
select plan(16);
create temp table u on commit drop as select
  tests.create_user('sa@example.test', 'super_admin') as sa,
  tests.create_user('ce@example.test', 'content_editor') as ce,
  tests.create_user('ht@example.test', 'headteacher') as ht,
  tests.create_user('ro@example.test', 'read_only_staff') as ro;
grant select on u to authenticated;
insert into public.pages (title, slug, status) values ('Admissions info', 'admissions-info', 'draft');

-- Approval off (default): the content editor publishes directly.
select tests.authenticate_as((select ce from u));
select lives_ok($$update public.pages set status = 'published', publish_at = now() where slug = 'admissions-info'$$,
  'content editor publishes when approval is off');
select is((select version from public.pages where slug = 'admissions-info'), 2, 'each update bumps the version');
select isnt((select published_at from public.pages where slug = 'admissions-info'), null, 'first publish sets published_at');
select tests.as_system();

select tests.authenticate_as((select ro from u));
update public.pages set title = 'Changed' where slug = 'admissions-info';
select is((select title from public.pages where slug = 'admissions-info'), 'Admissions info', 'read-only staff cannot change content');
select tests.as_system();

-- Approval on: editors submit for review, the headteacher approves (PRD §6.6).
select tests.set_feature('contentApproval', true);
insert into public.pages (title, slug, status) values ('Fees', 'fees', 'draft');
select tests.authenticate_as((select ce from u));
select throws_ok($$update public.pages set status = 'published', publish_at = now() where slug = 'fees'$$,
  '42501', 'TRANSITION_DENIED', 'with approval on, the content editor cannot publish');
select lives_ok($$update public.pages set status = 'in_review' where slug = 'fees'$$, 'content editor submits for review');
select tests.as_system();
select tests.authenticate_as((select ht from u));
select lives_ok($$update public.pages set status = 'published', publish_at = now() where slug = 'fees'$$, 'headteacher approves and publishes');
select tests.as_system();

-- Slug change on live content leaves a 308 redirect (MP §4.2).
select tests.authenticate_as((select sa from u), 'aal2');
update public.pages set slug = 'school-fees' where slug = 'fees';
select tests.as_system();
select is((select to_path from public.redirects where from_path = '/fees'), '/school-fees', 'renaming a slug writes a redirect');

-- Trash requires pages.delete; purge requires trash.purge.
select tests.authenticate_as((select ce from u));
select lives_ok($$update public.pages set deleted_at = now() where slug = 'school-fees'$$, 'content editor can move a page to Trash');
delete from public.pages where slug = 'school-fees';
select tests.as_system();
select is((select count(*)::int from public.pages where slug = 'school-fees'), 1, 'only trash.purge can permanently delete');

-- Scheduling and cancelling (plan §4, P4-A). Approval is still on here.
insert into public.pages (title, slug, status, publish_at) values ('Open day', 'open-day', 'scheduled', now() + interval '2 days');
select tests.authenticate_as((select ce from u));
select throws_ok($$update public.pages set status = 'draft' where slug = 'open-day'$$,
  '42501', 'TRANSITION_DENIED', 'with approval on, the content editor cannot cancel a schedule');
select tests.as_system();
select tests.authenticate_as((select ht from u));
select lives_ok($$update public.pages set status = 'draft' where slug = 'open-day'$$, 'the headteacher cancels it');
select tests.as_system();

select tests.set_feature('contentApproval', false);
select tests.authenticate_as((select ce from u));
select lives_ok($$update public.pages set status = 'scheduled', publish_at = now() + interval '1 day' where slug = 'open-day'$$,
  'with approval off, the content editor schedules a page');
select lives_ok($$update public.pages set status = 'draft' where slug = 'open-day'$$, '... and cancels the schedule');
select tests.as_system();

-- Restore brings back the status the item had when it was trashed.
insert into public.pages (title, slug, status, publish_at) values ('Uniform', 'uniform', 'published', now());
select tests.authenticate_as((select ce from u));
update public.pages set deleted_at = now() where slug = 'uniform';
select lives_ok($$update public.pages set deleted_at = null where slug = 'uniform'$$, 'the content editor restores a trashed page');
select is((select status::text from public.pages where slug = 'uniform'), 'published', 'it comes back published, as it was');
select tests.as_system();

select * from finish();
rollback;
