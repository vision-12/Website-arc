begin;
select plan(6);
select tests.seed_fixtures();
create temp table u on commit drop as select
  tests.create_user('ce@example.test', 'content_editor') as ce,
  tests.create_user('ao@example.test', 'admissions_officer') as ao;
grant select on u to authenticated;

select is((select public from storage.buckets where id = 'admission-documents'), false, 'admission documents bucket is private');
select is((select public from storage.buckets where id = 'media'), true, 'media bucket is public-read');
select is((select public from storage.buckets where id = 'resources'), true, 'resources bucket is public-read');

select tests.authenticate_as((select ce from u));
select is(tests.visible_rows('storage.objects', $$bucket_id = 'admission-documents'$$), 0, 'content editor cannot see admission documents');
select tests.as_system();
select tests.authenticate_as((select ao from u), 'aal1');
select is(tests.visible_rows('storage.objects', $$bucket_id = 'admission-documents'$$), 0, 'admissions officer without MFA cannot see admission documents');
select tests.as_system();
select tests.authenticate_as((select ao from u), 'aal2');
select is(tests.visible_rows('storage.objects', $$bucket_id = 'admission-documents'$$), 1, 'admissions officer with MFA can see admission documents (for signed URLs)');

select * from finish();
rollback;
