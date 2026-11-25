begin;
select plan(17);
select tests.seed_fixtures();

create temp table u on commit drop as select
  tests.create_user('ce@example.test', 'content_editor') as ce,
  tests.create_user('em@example.test', 'events_manager') as em,
  tests.create_user('ao@example.test', 'admissions_officer') as ao,
  tests.create_user('ht@example.test', 'headteacher') as ht,
  tests.create_user('ro@example.test', 'read_only_staff') as ro,
  tests.create_user('viewer-no-notes@example.test') as custom;
grant select on u to authenticated;

-- A custom role with admissions.view but not admissions.view_notes (MP §7.3).
insert into public.roles (key, name) values ('admissions_clerk', 'Admissions clerk');
insert into public.role_permissions (role_id, permission_key)
  select id, 'admissions.view' from public.roles where key = 'admissions_clerk';
insert into public.user_roles (user_id, role_id) select (select custom from u), id from public.roles where key = 'admissions_clerk';

-- Content Editor
select tests.authenticate_as((select ce from u));
select is(tests.visible_rows('public.applications'), 0, 'content editor cannot read applications');
select is(tests.visible_rows('public.contact_messages'), 0, 'content editor cannot read enquiries');
select is(tests.visible_rows('public.admission_notes'), 0, 'content editor cannot read admission notes');
select is(tests.visible_rows('public.pages', $$slug in ('draft-page', 'live-page', 'future-page')$$), 3, 'content editor sees all pages, including drafts');
select lives_ok($$insert into public.pages (title, slug) values ('New page', 'new-page')$$, 'content editor can create a page');
select is(tests.visible_rows('storage.objects', $$bucket_id = 'admission-documents'$$), 0, 'content editor cannot see admission documents');
select tests.as_system();

-- Events Manager
select tests.authenticate_as((select em from u));
select throws_ok($$insert into public.pages (title, slug) values ('Not mine', 'not-mine')$$, '42501', null,
  'events manager cannot create pages');
select is(tests.visible_rows('public.applications'), 0, 'events manager cannot read applications');
select tests.as_system();

-- Custom role without view_notes
select tests.authenticate_as((select custom from u));
select is(tests.visible_rows('public.applications'), 1, 'admissions.view reads applications');
select is(tests.visible_rows('public.admission_notes'), 0, 'without admissions.view_notes, notes are hidden');
select is(tests.visible_rows('public.application_medical'), 0, 'without admissions.view_medical, medical data is hidden');
select tests.as_system();

-- Admissions Officer (requires MFA: aal2)
select tests.authenticate_as((select ao from u), 'aal2');
select is(tests.visible_rows('public.admission_notes'), 1, 'admissions officer reads notes');
select is(tests.visible_rows('public.application_medical'), 0, 'admissions officer does not see medical data by default');
select tests.as_system();

-- Headteacher: oversight, no content creation
select tests.authenticate_as((select ht from u));
select is(tests.visible_rows('public.applications'), 1, 'headteacher reads applications');
select throws_ok($$insert into public.pages (title, slug) values ('By head', 'by-head')$$, '42501', null,
  'headteacher cannot create content (approves it instead)');
select tests.as_system();

-- Read-only staff
select tests.authenticate_as((select ro from u));
select throws_ok($$insert into public.pages (title, slug) values ('Ro', 'ro')$$, '42501', null, 'read-only staff cannot write');
select is(tests.visible_rows('public.contact_messages'), 0, 'read-only staff sees no personal data');

select * from finish();
rollback;
