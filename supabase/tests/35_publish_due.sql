-- Scheduled publishing (MP §5, spec §4.8): only the service role (the cron route) may run the job.
-- It publishes due, non-deleted scheduled items, audits each one, and returns their addresses so the
-- route can expire the right cache tags.
begin;
select plan(12);

select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'publish_due_content'), 'publish_due_content() exists');
select is(has_function_privilege('authenticated', 'public.publish_due_content()', 'execute'), false,
  'signed-in staff cannot run the scheduler themselves');
select is(has_function_privilege('anon', 'public.publish_due_content()', 'execute'), false, 'nor can visitors');
select is(has_function_privilege('service_role', 'public.publish_due_content()', 'execute'), true,
  'the service role (cron route) can');

insert into public.pages (id, title, slug, status, publish_at) values
  ('35000000-0000-4000-8000-000000000001', 'Due page', 'due-page-35', 'scheduled', now() - interval '1 minute'),
  ('35000000-0000-4000-8000-000000000002', 'Later page', 'later-page-35', 'scheduled', now() + interval '1 hour');
insert into public.pages (id, title, slug, status, publish_at, deleted_at) values
  ('35000000-0000-4000-8000-000000000003', 'Trashed due page', 'trashed-due-35', 'scheduled',
   now() - interval '1 minute', now());

select tests.as_anon();
select is(tests.visible_rows('public.pages', $$slug = 'due-page-35'$$), 0, 'a scheduled page is hidden before the job runs');
select tests.as_system();

select tests.as_service();
create temp table published on commit drop as select * from public.publish_due_content();
select tests.as_system();

select is((select count(*)::int from published where entity_id = '35000000-0000-4000-8000-000000000001'), 1,
  'the job publishes the due page');
select is((select count(*)::int from published where entity_id in ('35000000-0000-4000-8000-000000000002',
  '35000000-0000-4000-8000-000000000003')), 0, '... but not a later one or one in Trash');
select is((select path from published where entity_id = '35000000-0000-4000-8000-000000000001'), '/due-page-35',
  'and returns its address for cache revalidation');
select is((select status::text from public.pages where id = '35000000-0000-4000-8000-000000000001'), 'published',
  'the due page is now published');
select isnt((select published_at from public.pages where id = '35000000-0000-4000-8000-000000000001'), null,
  'its first-published time is set');
select is((select count(*)::int from public.activity_logs where action = 'pages.publish' and source = 'cron'
  and entity_id = '35000000-0000-4000-8000-000000000001'), 1, 'the job writes one audit entry per item');

select tests.as_anon();
select is(tests.visible_rows('public.pages', $$slug = 'due-page-35'$$), 1, 'visitors see the page after the job');
select tests.as_system();

select * from finish();
rollback;
