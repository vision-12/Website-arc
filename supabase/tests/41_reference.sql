begin;
select plan(5);

create temp table refs on commit drop as
  select g as n, private.next_application_reference('TST', now()) as ref from generate_series(1, 20000) g;

select is((select count(*)::int from refs where ref !~ '^TST-[0-9]{4}-[0-9A-HJKMNP-TV-Z]{6}$'), 0,
  'references match PREFIX-YYYY-XXXXXX using Crockford base32');
select is((select count(distinct ref)::int from refs), 20000, '20,000 references are unique');
select is((select count(*)::int from refs where not private.reference_checksum_ok(ref)), 0, 'every reference passes its checksum');
select ok(not private.reference_checksum_ok(
  (select left(ref, 14) || case when right(ref, 1) = '0' then '1' else '0' end from refs where n = 1)),
  'a single mistyped character fails the checksum');
-- Unguessable: consecutive references are not neighbours in sorted order.
select cmp_ok((select count(*)::int from (select n, lag(n) over (order by ref) as prev from refs) s where n = prev + 1),
  '<', 200, 'sequential generation does not produce sequential references');

select * from finish();
rollback;
