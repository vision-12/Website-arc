-- "Used in" tracking lives in the database (plan P4-E): saving a page records the photos and PDFs it
-- uses in the same statement, an undescribed photo cannot be saved onto a page, and an in-use photo
-- cannot be trashed or lose its description. Uploads stay invisible until the server has checked
-- them, and the media bucket no longer accepts SVG (plan P4-G).
begin;
select plan(15);

insert into public.roles (key, name, is_system) values ('uploader_only', 'Uploader', false);
insert into public.role_permissions (role_id, permission_key)
  select id, p from public.roles, unnest(array['media.view', 'media.create']) p where key = 'uploader_only';

create temp table u on commit drop as select
  tests.create_user('ce34@example.test', 'content_editor') as ce,
  tests.create_user('sa34@example.test', 'super_admin') as sa,
  tests.create_user('up34@example.test', 'uploader_only') as up;
grant select on u to authenticated;

insert into public.media_assets (id, kind, bucket, path, mime_type, size_bytes, width, height, alt_text) values
  ('34000000-0000-4000-8000-0000000000a1', 'image', 'media',
   '34000000-0000-4000-8000-0000000000a1/34000000-0000-4000-8000-0000000000b1.jpg', 'image/jpeg', 1000, 800, 600,
   'Pupils reading in the library'),
  ('34000000-0000-4000-8000-0000000000a2', 'image', 'media',
   '34000000-0000-4000-8000-0000000000a2/34000000-0000-4000-8000-0000000000b2.jpg', 'image/jpeg', 1000, 800, 600, null),
  ('34000000-0000-4000-8000-0000000000a3', 'document', 'media',
   '34000000-0000-4000-8000-0000000000a3/34000000-0000-4000-8000-0000000000b3.pdf', 'application/pdf', 5000, null, null, null);

-- Saving a page records what it uses, in the same statement.
select tests.authenticate_as((select ce from u));
select lives_ok($$insert into public.pages (id, title, slug, body) values ('34000000-0000-4000-8000-000000000001',
  'Library', 'library-34', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Welcome to the library"}]},
  {"type":"image","attrs":{"mediaId":"34000000-0000-4000-8000-0000000000a1"}}]}')$$,
  'the content editor saves a page with a described photo');
select tests.as_system();
select is((select array_agg(media_id::text) from public.media_usages where entity_type = 'pages'
  and entity_id = '34000000-0000-4000-8000-000000000001' and field = 'body'),
  array['34000000-0000-4000-8000-0000000000a1'], 'the photo is recorded as used in the page body');
select is((select body_text from public.pages where id = '34000000-0000-4000-8000-000000000001'),
  'Welcome to the library', 'the searchable text is derived from the body');

select tests.authenticate_as((select ce from u));
select throws_ok($$update public.pages set body = '{"type":"doc","content":[{"type":"image","attrs":{"mediaId":"34000000-0000-4000-8000-0000000000a2"}}]}'
  where id = '34000000-0000-4000-8000-000000000001'$$,
  '23514', 'ALT_TEXT_REQUIRED', 'a photo without a description cannot be saved into the page text');
select throws_ok($$update public.pages set cover_media_id = '34000000-0000-4000-8000-0000000000a2'
  where id = '34000000-0000-4000-8000-000000000001'$$,
  '23514', 'ALT_TEXT_REQUIRED', '... nor used as the cover');
select lives_ok($$update public.pages set cover_media_id = '34000000-0000-4000-8000-0000000000a1',
  body = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Fees letter","marks":[{"type":"link",
  "attrs":{"href":"/x.pdf","mediaId":"34000000-0000-4000-8000-0000000000a3"}}]}]}]}'
  where id = '34000000-0000-4000-8000-000000000001'$$, 'the editor swaps the photo for a PDF link and sets a cover');
select tests.as_system();
select is((select array_agg(field || ':' || media_id::text order by field) from public.media_usages
  where entity_type = 'pages' and entity_id = '34000000-0000-4000-8000-000000000001'),
  array['body:34000000-0000-4000-8000-0000000000a3', 'cover:34000000-0000-4000-8000-0000000000a1'],
  'usages follow the edit: the removed photo is released, the PDF and cover are recorded');

select tests.authenticate_as((select ce from u));
select throws_ok($$update public.media_assets set deleted_at = now() where id = '34000000-0000-4000-8000-0000000000a1'$$,
  '23503', 'MEDIA_IN_USE', 'a photo used on a page cannot be moved to Trash');
select throws_ok($$update public.media_assets set alt_text = '' where id = '34000000-0000-4000-8000-0000000000a1'$$,
  '23514', 'ALT_TEXT_REQUIRED', 'a photo used on a page cannot lose its description');

-- Uploads are invisible until the server has checked them.
insert into public.media_assets (id, kind, bucket, path, mime_type, size_bytes, uploaded_by) values
  ('34000000-0000-4000-8000-0000000000a4', 'image', 'media',
   '34000000-0000-4000-8000-0000000000a4/34000000-0000-4000-8000-0000000000b4.png', 'image/png', 900, (select ce from u));
select tests.as_system();
select tests.as_anon();
select is(tests.visible_rows('public.media_assets', $$id = '34000000-0000-4000-8000-0000000000a4'$$), 0,
  'visitors cannot see an upload the server has not checked');
select tests.as_system();
select is((select confirmed_at from public.media_assets where id = '34000000-0000-4000-8000-0000000000a4'), null,
  'a browser-created media row always starts unconfirmed');

-- Someone who may upload but not edit the library can still finish their own upload.
select tests.authenticate_as((select up from u));
insert into public.media_assets (id, kind, bucket, path, mime_type, size_bytes, uploaded_by) values
  ('34000000-0000-4000-8000-0000000000a5', 'image', 'media',
   '34000000-0000-4000-8000-0000000000a5/34000000-0000-4000-8000-0000000000b5.png', 'image/png', 900, (select up from u));
update public.media_assets set confirmed_at = now(), width = 10, height = 10 where id = '34000000-0000-4000-8000-0000000000a5';
select tests.as_system();
select isnt((select confirmed_at from public.media_assets where id = '34000000-0000-4000-8000-0000000000a5'), null,
  'an uploader without media.edit confirms their own upload');

-- Purging a page releases what it used.
select tests.authenticate_as((select ce from u));
update public.pages set deleted_at = now() where id = '34000000-0000-4000-8000-000000000001';
select tests.as_system();
select tests.authenticate_as((select sa from u), 'aal2');
select lives_ok($$delete from public.pages where id = '34000000-0000-4000-8000-000000000001'$$,
  'the super administrator purges the trashed page');
select tests.as_system();
select is((select count(*)::int from public.media_usages where entity_id = '34000000-0000-4000-8000-000000000001'), 0,
  'purging a page clears its usages');

select is((select 'image/svg+xml' = any (allowed_mime_types) from storage.buckets where id = 'media'), false,
  'the media bucket refuses SVG until it can be sanitised (Phase 5)');

select * from finish();
rollback;
