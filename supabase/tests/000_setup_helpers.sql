-- Installs test helpers once per test run (committed, not rolled back). Other files roll back.
select plan(1);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Creates an auth user (+ profile via trigger), sets its status and assigns a role by key.
create or replace function tests.create_user(p_email text, p_role text default null, p_status text default 'active')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, invited_at)
  values (v_id, p_email, jsonb_build_object('full_name', split_part(p_email, '@', 1)), now());
  update public.profiles set status = p_status::public.profile_status where id = v_id;
  if p_role is not null then
    insert into public.user_roles (user_id, role_id)
    select v_id, r.id from public.roles r where r.key = p_role;
  end if;
  return v_id;
end $$;

-- Act as a signed-in user for the rest of the transaction.
create or replace function tests.authenticate_as(p_user uuid, p_aal text default 'aal1')
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function tests.as_anon() returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

create or replace function tests.as_system() returns void language plpgsql set search_path = '' as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- One row of every sensitive kind, created as the system (bypassing RLS). Returns ids by name.
create or replace function tests.seed_fixtures() returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := '{}'::jsonb;
  v_form uuid; v_version uuid; v_intake uuid; v_class uuid; v_status uuid; v_app uuid; v_msg uuid;
begin
  insert into public.pages (title, slug, status) values ('Draft page', 'draft-page', 'draft');
  insert into public.pages (title, slug, status, publish_at) values ('Live page', 'live-page', 'published', now() - interval '1 day');
  insert into public.pages (title, slug, status, publish_at) values ('Future page', 'future-page', 'published', now() + interval '1 day');

  insert into public.admission_forms (name, is_default) values ('Default form', true) returning id into v_form;
  insert into public.admission_form_versions (form_id, version, definition, published_at)
    values (v_form, 1, '{"steps":[]}', now()) returning id into v_version;
  insert into public.admission_intakes (name, slug, academic_year, term, opens_at, closes_at, form_version_id, status, publish_at)
    values ('S1 2027', 's1-2027', 2027, 'Term 1', now() - interval '1 day', now() + interval '30 days', v_version, 'published', now() - interval '1 day')
    returning id into v_intake;
  insert into public.admission_intake_classes (intake_id, label) values (v_intake, 'Senior One') returning id into v_class;
  select id into v_status from public.admission_statuses where is_initial;
  insert into public.applications (reference, intake_id, intake_class_id, form_version_id, status_id,
      applicant_first_name, applicant_last_name, applicant_dob, guardian_name, guardian_relationship,
      guardian_email, guardian_phone_e164, consent_text_version, consented_at, consent_ip_hash, submitted_at, status_changed_at)
    values ('TST-2027-AAAAAA', v_intake, v_class, v_version, v_status, 'Ada', 'Test', '2014-01-01', 'Grace Test', 'Mother',
      'guardian@example.test', '+256700000000', 'v1', now(), 'iphash', now(), now())
    returning id into v_app;
  insert into public.application_medical (application_id, answers) values (v_app, '{"allergies":"none"}');
  insert into public.admission_notes (application_id, author_id, body) values (v_app, null, 'Internal note');
  insert into public.application_documents (application_id, requirement_key, path, state)
    values (v_app, 'birth_certificate', v_app::text || '/doc.pdf', 'uploaded');
  insert into public.admission_status_history (application_id, to_status_id, public_message) values (v_app, v_status, 'Received');

  insert into public.contact_messages (name, email, subject, message, consent_text_version, consented_at, ip_hash)
    values ('Visitor', 'visitor@example.test', 'General enquiry', 'Hello, I would like to know more about admissions.', 'v1', now(), 'iphash')
    returning id into v_msg;
  insert into public.enquiry_notes (message_id, body) values (v_msg, 'Called back');

  insert into public.activity_logs (source, action, summary) values ('db', 'test.event', 'fixture');
  insert into storage.objects (bucket_id, name) values ('admission-documents', v_app::text || '/doc.pdf');

  v := jsonb_build_object('application', v_app, 'intake', v_intake, 'message', v_msg, 'status', v_status);
  return v;
end $$;

-- Rows the current role can see; 0 when it lacks the privilege entirely.
create or replace function tests.visible_rows(p_table text) returns int language plpgsql set search_path = '' as $$
declare n int;
begin
  execute format('select count(*) from %s', p_table) into n;
  return n;
exception when insufficient_privilege then return 0;
end $$;

-- Sets one feature flag in site_settings (creating a minimal row if needed). System context only.
create or replace function tests.set_feature(p_flag text, p_on boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.site_settings (id, data) values (1, jsonb_build_object('features', jsonb_build_object(p_flag, p_on)))
  on conflict (id) do update set data = jsonb_set(coalesce(public.site_settings.data, '{}'), array['features', p_flag], to_jsonb(p_on), true);
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select pass('test helpers installed');
select * from finish();
