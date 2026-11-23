begin;
select plan(4);

-- The content-lifecycle (LC) policy template, checked on the reference table `pages`.
select policies_are('public', 'pages', array['pages_select', 'pages_insert', 'pages_update', 'pages_delete']);
select ok((select qual from pg_policies where tablename = 'pages' and policyname = 'pages_select')
  ~ $$status = 'published'.*publish_at <= now\(\).*deleted_at IS NULL.*has_permission\('pages\.view'$$,
  'select: published-and-live, or pages.view');
select ok((select with_check from pg_policies where tablename = 'pages' and policyname = 'pages_insert')
  ~ $$has_permission\('pages\.create'$$, 'insert requires pages.create');
select ok((select qual from pg_policies where tablename = 'pages' and policyname = 'pages_delete')
  ~ $$deleted_at IS NOT NULL.*has_permission\('trash\.purge'$$, 'hard delete only of trashed rows with trash.purge');

select * from finish();
rollback;
