-- Buckets and staff storage policies (spec §3.9, MP §7.4). Applicant upload-slot policies: Phase 12c.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 20971520,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml', 'application/pdf']),
  ('resources', 'resources', true, 20971520,
   array['application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('admission-documents', 'admission-documents', false, 20971520,
   array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- media (public bucket: files are read by public URL; no anon SELECT policy, so listing is impossible)
create policy media_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'media' and (select public.has_permission('media.view')));
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select public.has_permission('media.create'))
              and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif|gif|svg|pdf)$');
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select public.has_permission('media.edit')))
  with check (bucket_id = 'media' and (select public.has_permission('media.edit')));
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((select public.has_permission('media.delete')) or (select public.has_permission('trash.purge'))));

-- resources (public bucket)
create policy resources_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'resources' and (select public.has_permission('resources.view')));
create policy resources_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'resources' and (select public.has_permission('resources.create'))
              and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|docx|xlsx|pptx)$');
create policy resources_update on storage.objects for update to authenticated
  using (bucket_id = 'resources' and (select public.has_permission('resources.edit')))
  with check (bucket_id = 'resources' and (select public.has_permission('resources.edit')));
create policy resources_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resources' and ((select public.has_permission('resources.delete')) or (select public.has_permission('trash.purge'))));

-- admission-documents (private): staff read only to mint 60-second signed URLs after a permission check.
create policy admdocs_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'admission-documents' and (select public.has_permission('admissions.view'))
         and (select private.mfa_satisfied()));
create policy admdocs_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'admission-documents' and (select public.has_permission('admissions.delete'))
         and (select private.mfa_satisfied()));
