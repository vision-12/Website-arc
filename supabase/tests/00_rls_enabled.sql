begin;
select plan(3);

select is(
  array(
    select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity order by 1
  ),
  '{}'::text[],
  'every table in public has row level security enabled'
);

-- Tables reachable only through security-definer RPCs may have no policies; nothing else may.
select is(
  array(
    select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
      and c.relname not in ('application_upload_sessions')
    order by 1
  ),
  '{}'::text[],
  'every table has at least one policy (except RPC-only tables)'
);

select cmp_ok(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'),
  '>=', 30, 'the core schema is present'
);

select * from finish();
rollback;
