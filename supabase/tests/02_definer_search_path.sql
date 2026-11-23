begin;
select plan(2);

select is(
  array(
    select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and not coalesce(p.proconfig @> array['search_path=""'], false)
    order by 1
  ),
  '{}'::text[],
  'every security-definer function pins search_path to empty'
);

select ok(
  not exists (select 1 from information_schema.schemata where schema_name = 'private')
  or not has_schema_privilege('anon', 'private', 'CREATE'),
  'the private schema is not writable by anon'
);

select * from finish();
rollback;
