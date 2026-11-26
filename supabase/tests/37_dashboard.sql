-- Dashboard and editor helpers (MP §5.10, plan P4-A, P4-K): counts follow RLS (security invoker),
-- the "sent back" note is readable by anyone who can view the page, and staff names are visible to
-- staff only.
begin;
select plan(11);
create temp table u on commit drop as select
  tests.create_user('ce37@example.test', 'content_editor') as ce,
  tests.create_user('ht37@example.test', 'headteacher') as ht,
  tests.create_user('ao37@example.test', 'admissions_officer') as ao;
grant select on u to authenticated;

select is(has_function_privilege('anon', 'public.get_dashboard_counts()', 'execute'), false,
  'visitors cannot read dashboard counts');

select tests.authenticate_as((select ce from u));
create temp table before_counts on commit drop as select public.get_dashboard_counts() as c;
select tests.as_system();
insert into public.pages (id, title, slug, status, publish_at) values
  ('37000000-0000-4000-8000-000000000001', 'Open day', 'open-day-37', 'scheduled', now() + interval '3 hours');
-- Inserted with an old date: the lifecycle trigger stamps updated_at on every update.
insert into public.pages (id, title, slug, status, updated_at) values
  ('37000000-0000-4000-8000-000000000002', 'Old draft', 'old-draft-37', 'draft', now() - interval '45 days');
insert into public.media_assets (kind, bucket, path, mime_type, size_bytes, width, height) values
  ('image', 'media', '37000000-0000-4000-8000-0000000000a1/37000000-0000-4000-8000-0000000000b1.jpg', 'image/jpeg',
   100, 10, 10);

select tests.authenticate_as((select ce from u));
select is((public.get_dashboard_counts() ->> 'pagesScheduledSoon')::int
  - ((select c from before_counts) ->> 'pagesScheduledSoon')::int, 1, 'a page scheduled in the next 48 hours is counted');
select is((public.get_dashboard_counts() ->> 'pagesStaleDrafts')::int
  - ((select c from before_counts) ->> 'pagesStaleDrafts')::int, 1, 'a draft untouched for 30 days is counted');
select is((public.get_dashboard_counts() ->> 'mediaMissingAlt')::int
  - ((select c from before_counts) ->> 'mediaMissingAlt')::int, 1, 'a photo without a description is counted');
select tests.as_system();

select tests.authenticate_as((select ao from u));
select is((public.get_dashboard_counts() ->> 'pagesStaleDrafts')::int, 0,
  'counts follow RLS: someone without pages.view counts no drafts');
select tests.as_system();

-- "Send back with a note" (approval workflow): the note is shown to the author until resubmission.
select tests.authenticate_as((select ht from u));
select public.log_activity('pages.send_back', 'Sent back "Open day"', 'pages', '37000000-0000-4000-8000-000000000001',
  null, '{"note":"Please add the timetable."}');
select tests.as_system();
select tests.authenticate_as((select ce from u));
select is((select note from public.latest_review_note('pages', '37000000-0000-4000-8000-000000000001')),
  'Please add the timetable.', 'the author sees the note');
select is((select author from public.latest_review_note('pages', '37000000-0000-4000-8000-000000000001')), 'ht37',
  '... and who sent it back');
select public.log_activity('pages.submit', 'Submitted "Open day" for review', 'pages', '37000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.latest_review_note('pages', '37000000-0000-4000-8000-000000000001')), 0,
  'once resubmitted, the note is no longer shown');
select tests.as_system();
select tests.authenticate_as((select ao from u));
select public.log_activity('pages.send_back', 'x', 'pages', '37000000-0000-4000-8000-000000000002', null, '{"note":"n"}');
select is((select count(*)::int from public.latest_review_note('pages', '37000000-0000-4000-8000-000000000002')), 0,
  'someone without pages.view sees no notes');
select tests.as_system();

select tests.authenticate_as((select ao from u));
select is((select full_name from public.staff_names(array[(select ce from u)])), 'ce37',
  'staff can see a colleague''s name ("Last edited by")');
select tests.as_system();
select is(has_function_privilege('anon', 'public.staff_names(uuid[])', 'execute'), false, 'visitors cannot');

select * from finish();
rollback;
