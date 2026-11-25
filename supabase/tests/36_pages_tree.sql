-- Page tree rules (spec §1.4, plan P4-J): built-in pages can't be moved, renamed or deleted; a page
-- can't be moved inside itself; a page with sub-pages can't go to Trash, and a sub-page can't be
-- restored while its parent is in Trash. Reordering goes through reorder_pages(), as the caller.
begin;
select plan(13);
create temp table u on commit drop as select
  tests.create_user('ce36@example.test', 'content_editor') as ce,
  tests.create_user('sa36@example.test', 'super_admin') as sa,
  tests.create_user('ro36@example.test', 'read_only_staff') as ro;
grant select on u to authenticated;

insert into public.pages (id, title, slug, status, publish_at, nav_order) values
  ('36000000-0000-4000-8000-000000000001', 'Tree root', 'tree-root-36', 'published', now(), 10),
  ('36000000-0000-4000-8000-000000000003', 'Tree sibling', 'tree-sibling-36', 'published', now(), 20);
insert into public.pages (id, parent_id, title, slug, status, publish_at) values
  ('36000000-0000-4000-8000-000000000002', '36000000-0000-4000-8000-000000000001', 'Tree child', 'tree-child-36',
   'published', now());
insert into public.pages (id, title, slug, system_key, status, publish_at) values
  ('36000000-0000-4000-8000-000000000004', 'Built in', 'built-in-36', 'test_system_36', 'published', now());

select tests.authenticate_as((select ce from u));
select throws_ok($$update public.pages set deleted_at = now() where id = '36000000-0000-4000-8000-000000000001'$$,
  '22023', 'VALIDATION', 'a page with sub-pages cannot be moved to Trash');
select throws_ok($$update public.pages set parent_id = '36000000-0000-4000-8000-000000000002'
  where id = '36000000-0000-4000-8000-000000000001'$$, '22023', 'VALIDATION', 'a page cannot be moved inside its own sub-page');
select lives_ok($$update public.pages set deleted_at = now() where id = '36000000-0000-4000-8000-000000000002'$$,
  'the sub-page goes to Trash first');
select lives_ok($$update public.pages set deleted_at = now() where id = '36000000-0000-4000-8000-000000000001'$$,
  'then the parent can');
select throws_ok($$update public.pages set deleted_at = null where id = '36000000-0000-4000-8000-000000000002'$$,
  '22023', 'VALIDATION', 'a sub-page cannot be restored while its parent is in Trash');
select throws_ok($$insert into public.pages (title, slug, parent_id) values ('Orphan', 'orphan-36',
  '36000000-0000-4000-8000-000000000001')$$, '22023', 'VALIDATION', 'nothing can be added under a page in Trash');
select lives_ok($$update public.pages set deleted_at = null where id in ('36000000-0000-4000-8000-000000000001')$$,
  'restoring the parent works');
select is((select status::text from public.pages where id = '36000000-0000-4000-8000-000000000001'), 'published',
  'restore brings back the previous status');
select throws_ok($$insert into public.pages (title, slug, system_key) values ('Sneaky', 'sneaky-36', 'privacy')$$,
  '42501', 'FORBIDDEN', 'people cannot create built-in pages');

select lives_ok($$select public.reorder_pages(null, array['36000000-0000-4000-8000-000000000003',
  '36000000-0000-4000-8000-000000000001']::uuid[])$$, 'the content editor reorders top-level pages');
select ok((select nav_order from public.pages where id = '36000000-0000-4000-8000-000000000003')
  < (select nav_order from public.pages where id = '36000000-0000-4000-8000-000000000001'), '... and the order changed');
select tests.as_system();

select tests.authenticate_as((select sa from u), 'aal2');
select throws_ok($$update public.pages set deleted_at = now() where id = '36000000-0000-4000-8000-000000000004'$$,
  '22023', 'VALIDATION', 'even a super administrator cannot trash a built-in page');
select throws_ok($$update public.pages set slug = 'renamed-36' where id = '36000000-0000-4000-8000-000000000004'$$,
  '22023', 'VALIDATION', 'or change its address');
select tests.as_system();

select * from finish();
rollback;
