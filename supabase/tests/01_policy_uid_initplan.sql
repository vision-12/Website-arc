begin;
select plan(2);

-- MP §7.2: auth.uid()/auth.jwt() must be wrapped as (select auth.uid()) so Postgres evaluates it
-- once per statement (initPlan), not once per row. Deparsed, the wrapped form reads "SELECT auth.uid()".
select is(
  array(
    select format('%s.%s/%s', schemaname, tablename, policyname) from pg_policies
    where schemaname in ('public', 'storage')
      and regexp_count(coalesce(qual, '') || ' ' || coalesce(with_check, ''), 'auth\.uid\(\)')
        <> regexp_count(coalesce(qual, '') || ' ' || coalesce(with_check, ''), 'SELECT auth\.uid\(\)')
    order by 1
  ),
  '{}'::text[],
  'no policy calls a bare auth.uid()'
);

select is(
  array(
    select format('%s.%s/%s', schemaname, tablename, policyname) from pg_policies
    where schemaname in ('public', 'storage')
      and regexp_count(coalesce(qual, '') || ' ' || coalesce(with_check, ''), 'auth\.jwt\(\)')
        <> regexp_count(coalesce(qual, '') || ' ' || coalesce(with_check, ''), 'SELECT auth\.jwt\(\)')
    order by 1
  ),
  '{}'::text[],
  'no policy calls a bare auth.jwt()'
);

select * from finish();
rollback;
