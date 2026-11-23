begin;
select plan(3);

-- Belt and braces (spec §3.0): anon holds no write privilege on any table, whatever the policies say.
select is(
  array(
    select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE') or has_table_privilege('anon', c.oid, 'TRUNCATE'))
    order by 1
  ),
  '{}'::text[],
  'anon has no INSERT/UPDATE/DELETE/TRUNCATE on any public table'
);

select tests.as_anon();
select throws_ok($$insert into public.contact_messages (name, email, subject, message, consent_text_version, consented_at, ip_hash)
  values ('x', 'x@example.test', 'General enquiry', 'Hello there, this is a direct insert.', 'v1', now(), 'h')$$,
  '42501', null, 'anon cannot insert enquiries directly (only through submit_enquiry)');
select throws_ok($$insert into public.pages (title, slug) values ('Defaced', 'defaced')$$,
  '42501', null, 'anon cannot create pages');

select * from finish();
rollback;
