-- Autosave working copies are per person (plan P4-D, ADR-005): two people editing the same page
-- never overwrite each other's unsaved text, and nobody can read or change someone else's copy.
begin;
select plan(10);
create temp table u on commit drop as select
  tests.create_user('ce33@example.test', 'content_editor') as ce,
  tests.create_user('adm33@example.test', 'school_admin') as adm,
  tests.create_user('em33@example.test', 'admissions_officer') as ao;
grant select on u to authenticated;
insert into public.pages (id, title, slug) values ('33000000-0000-4000-8000-000000000001', 'Working copies', 'working-copies-33');

select tests.authenticate_as((select ce from u));
select lives_ok($$insert into public.content_drafts (entity_type, entity_id, data, base_version, updated_by)
  values ('pages', '33000000-0000-4000-8000-000000000001', '{"title":"Editor text"}', 1, (select ce from u))$$,
  'the content editor autosaves a working copy');
select tests.as_system();

select tests.authenticate_as((select adm from u));
select lives_ok($$insert into public.content_drafts (entity_type, entity_id, data, base_version, updated_by)
  values ('pages', '33000000-0000-4000-8000-000000000001', '{"title":"Admin text"}', 1, (select adm from u))$$,
  'a second person editing the same page gets a copy of their own, not an overwrite');
select tests.as_system();

select tests.authenticate_as((select ce from u));
select is(tests.visible_rows('public.content_drafts', $$entity_id = '33000000-0000-4000-8000-000000000001'$$), 1,
  'you see only your own working copy');
select lives_ok($$update public.content_drafts set data = '{"title":"Overwritten"}' where updated_by = (select adm from u)$$,
  'trying to change someone else''s copy changes nothing');
delete from public.content_drafts where updated_by = (select adm from u);
select is((select count(*)::int from public.content_editors('pages', '33000000-0000-4000-8000-000000000001')), 1,
  'content_editors() says someone else is editing this page');
select is((select full_name from public.content_editors('pages', '33000000-0000-4000-8000-000000000001')), 'adm33',
  '... and who, without their text');
select tests.as_system();
select is((select data ->> 'title' from public.content_drafts where updated_by = (select adm from u)), 'Admin text',
  'the other person''s copy survives the attempted update and delete');

select tests.authenticate_as((select ao from u));
select throws_ok($$insert into public.content_drafts (entity_type, entity_id, data, base_version, updated_by)
  values ('pages', '33000000-0000-4000-8000-000000000001', '{}', 1, (select ao from u))$$,
  '42501', null, 'no working copy without pages.edit');
select is((select count(*)::int from public.content_editors('pages', '33000000-0000-4000-8000-000000000001')), 0,
  'content_editors() reveals nothing without pages.edit');
select tests.as_system();

-- Permanently deleting a page removes every working copy of it.
update public.pages set deleted_at = now() where id = '33000000-0000-4000-8000-000000000001';
delete from public.pages where id = '33000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.content_drafts where entity_id = '33000000-0000-4000-8000-000000000001'), 0,
  'purging a page removes its working copies');

select * from finish();
rollback;
