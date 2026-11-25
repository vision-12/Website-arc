begin;
select plan(26);
select tests.seed_fixtures();
select tests.as_anon();

-- Public content: only published rows whose publish time has passed.
select is(tests.visible_rows('public.pages', $$slug in ('draft-page', 'live-page', 'future-page')$$), 1, 'anon sees only the live page (not drafts or future pages)');
select is((select slug from public.pages where slug in ('draft-page', 'live-page', 'future-page')), 'live-page', 'the visible page is the published one');
select is(tests.visible_rows('public.admission_intakes'), 1, 'anon sees the published intake');
select is(tests.visible_rows('public.admission_intake_classes'), 1, 'anon sees classes of a published intake');
select is(tests.visible_rows('public.admission_form_versions'), 1, 'anon sees the form version of a published intake');

-- MP §7.3: nothing private is readable anonymously.
select is(tests.visible_rows('public.' || t), 0, format('anon cannot read %s', t))
from unnest(array[
  'applications', 'application_medical', 'application_documents', 'admission_notes', 'admission_status_history',
  'admission_info_requests', 'application_upload_sessions', 'admission_statuses', 'admission_forms',
  'contact_messages', 'enquiry_notes', 'activity_logs', 'profiles', 'user_roles', 'support_access_grants',
  'auth_admin_jobs', 'site_settings_private', 'email_messages', 'email_suppressions', 'content_drafts'
]) as t;

select is(tests.visible_rows('storage.objects'), 0, 'anon cannot list or read storage objects');

select * from finish();
rollback;
