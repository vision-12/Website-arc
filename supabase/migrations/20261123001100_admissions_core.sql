-- Admissions core schema and RLS (spec §1.10, §3.7; decision P2-A). RPCs and UI arrive in Phase 12.

create table public.admission_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  is_default boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index admission_forms_one_default on public.admission_forms (is_default) where is_default;
create index admission_forms_created_by_idx on public.admission_forms (created_by);

create table public.admission_form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.admission_forms (id) on delete cascade,
  version integer not null check (version > 0),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (form_id, version)
);
create index form_versions_published_by_idx on public.admission_form_versions (published_by);

create or replace function private.form_version_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.published_at is not null then
    raise exception 'FORBIDDEN' using errcode = '42501', detail = 'A published form version cannot change.';
  end if;
  return new;
end $$;
create trigger form_versions_immutable before update on public.admission_form_versions
  for each row execute function private.form_version_immutable();

create table public.admission_intakes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  academic_year smallint not null check (academic_year between 2000 and 2100),
  term text,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  form_version_id uuid not null references public.admission_form_versions (id) on delete restrict,
  required_documents jsonb not null default '[]' check (jsonb_typeof(required_documents) = 'array'),
  resource_ids uuid[] not null default '{}',
  capacity integer check (capacity > 0),
  description jsonb,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at > opens_at),
  check (status not in ('scheduled', 'published') or publish_at is not null)
);
create unique index admission_intakes_slug_live on public.admission_intakes (slug) where deleted_at is null;
create index admission_intakes_form_version_idx on public.admission_intakes (form_version_id);
create index admission_intakes_publish_idx on public.admission_intakes (publish_at desc) where status = 'published' and deleted_at is null;
create index admission_intakes_created_by_idx on public.admission_intakes (created_by);
create index admission_intakes_updated_by_idx on public.admission_intakes (updated_by);
create index admission_intakes_deleted_by_idx on public.admission_intakes (deleted_by);

create table public.admission_intake_classes (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.admission_intakes (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  level_id uuid,
  sort_order integer not null default 0
);
create index intake_classes_intake_idx on public.admission_intake_classes (intake_id);

create table public.admission_statuses (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]{2,40}$'),
  name text not null,
  public_label text not null,
  colour text not null check (colour ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  is_initial boolean not null default false,
  is_terminal boolean not null default false,
  outcome text not null check (outcome in ('pending', 'accepted', 'rejected', 'withdrawn')),
  notify_applicant boolean not null default true,
  email_template_key text,
  deleted_at timestamptz
);
create unique index admission_statuses_one_initial on public.admission_statuses (is_initial) where is_initial;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  intake_id uuid not null references public.admission_intakes (id) on delete restrict,
  intake_class_id uuid not null references public.admission_intake_classes (id) on delete restrict,
  form_version_id uuid not null references public.admission_form_versions (id) on delete restrict,
  status_id uuid not null references public.admission_statuses (id) on delete restrict,
  applicant_first_name text not null check (char_length(applicant_first_name) between 1 and 80),
  applicant_last_name text not null check (char_length(applicant_last_name) between 1 and 80),
  applicant_other_names text check (char_length(applicant_other_names) <= 120),
  applicant_dob date not null check (applicant_dob > '1950-01-01'),
  applicant_gender text check (char_length(applicant_gender) <= 30),
  guardian_name text not null check (char_length(guardian_name) between 2 and 120),
  guardian_relationship text not null check (char_length(guardian_relationship) between 2 and 40),
  guardian_email extensions.citext not null,
  guardian_phone_e164 text not null check (guardian_phone_e164 ~ '^\+[1-9]\d{7,14}$'),
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  consent_text_version text not null,
  consented_at timestamptz not null,
  consent_ip_hash text not null,
  submitted_at timestamptz not null,
  status_changed_at timestamptz not null,
  assigned_to uuid references public.profiles (id) on delete set null,
  anonymised_at timestamptz,
  deleted_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_intake_status_idx on public.applications (intake_id, status_id);
create index applications_status_age_idx on public.applications (status_id, status_changed_at);
create index applications_submitted_idx on public.applications (submitted_at);
create index applications_class_idx on public.applications (intake_class_id);
create index applications_form_version_idx on public.applications (form_version_id);
create index applications_assigned_idx on public.applications (assigned_to);
create index applications_guardian_email_idx on public.applications (lower(guardian_email::text));
create index applications_guardian_phone_idx on public.applications (guardian_phone_e164);
create index applications_name_trgm_idx on public.applications
  using gin ((applicant_last_name || ' ' || applicant_first_name) extensions.gin_trgm_ops);

create table public.application_medical (
  application_id uuid primary key references public.applications (id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now()
);

create table public.application_upload_sessions (
  application_id uuid primary key,
  intake_id uuid not null references public.admission_intakes (id) on delete cascade,
  token_hash bytea not null,
  ip_hash text,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index upload_sessions_intake_idx on public.application_upload_sessions (intake_id);
create index upload_sessions_expiry_idx on public.application_upload_sessions (expires_at);

create table public.admission_info_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  token_hash bytea not null unique,
  requested_items jsonb not null default '[]',
  message text check (char_length(message) <= 1000),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index info_requests_application_idx on public.admission_info_requests (application_id);
create index info_requests_created_by_idx on public.admission_info_requests (created_by);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,  -- an upload session id before submission, then the application id
  requirement_key text not null check (requirement_key ~ '^[a-z0-9_]{1,40}$'),
  info_request_id uuid references public.admission_info_requests (id) on delete set null,
  path text not null unique,
  mime_type text check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint check (size_bytes > 0),
  sha256 text,
  state public.upload_state not null default 'pending',
  expires_at timestamptz,
  review public.document_review not null default 'unreviewed',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index application_documents_application_idx on public.application_documents (application_id);
create index application_documents_state_idx on public.application_documents (state, expires_at);
create index application_documents_info_request_idx on public.application_documents (info_request_id);
create index application_documents_reviewed_by_idx on public.application_documents (reviewed_by);

create or replace function private.document_owner_exists()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.applications where id = new.application_id)
     and not exists (select 1 from public.application_upload_sessions where application_id = new.application_id) then
    raise exception 'VALIDATION' using errcode = '23503', detail = 'Unknown application or upload session.';
  end if;
  return new;
end $$;
-- Staff reviews may only change review fields; file location and integrity data are fixed.
create or replace function private.application_document_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_end_user() then
    if (new.application_id, new.requirement_key, new.info_request_id, new.path, new.mime_type, new.size_bytes,
        new.sha256, new.state, new.expires_at, new.created_at)
       is distinct from (old.application_id, old.requirement_key, old.info_request_id, old.path, old.mime_type,
        old.size_bytes, old.sha256, old.state, old.expires_at, old.created_at) then
      raise exception 'FORBIDDEN' using errcode = '42501', detail = 'Only the review can be changed.';
    end if;
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;
  return new;
end $$;
create trigger application_documents_guard before update on public.application_documents
  for each row execute function private.application_document_guard();

create trigger application_documents_owner before insert or update of application_id on public.application_documents
  for each row execute function private.document_owner_exists();

create table public.admission_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status_id uuid references public.admission_statuses (id) on delete restrict,
  to_status_id uuid not null references public.admission_statuses (id) on delete restrict,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  public_message text check (char_length(public_message) <= 1000)
);
create index status_history_application_idx on public.admission_status_history (application_id, changed_at);
create index status_history_from_idx on public.admission_status_history (from_status_id);
create index status_history_to_idx on public.admission_status_history (to_status_id);
create index status_history_changed_by_idx on public.admission_status_history (changed_by);

create table public.admission_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  status_history_id uuid references public.admission_status_history (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index admission_notes_application_idx on public.admission_notes (application_id);
create index admission_notes_history_idx on public.admission_notes (status_history_id);
create index admission_notes_author_idx on public.admission_notes (author_id);

create trigger status_history_append_only before update or delete on public.admission_status_history
  for each row execute function private.forbid_update_delete();
create trigger admission_notes_append_only before update or delete on public.admission_notes
  for each row execute function private.forbid_update_delete();
create trigger admission_notes_author before insert on public.admission_notes
  for each row execute function private.set_author();

-- Staff can assign and annotate applications, never rewrite what the guardian submitted or skip the
-- status-change RPC (which records history and sends notifications).
create or replace function private.application_update_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  if private.is_end_user() then
    if (new.reference, new.intake_id, new.form_version_id, new.consent_text_version, new.consented_at,
        new.consent_ip_hash, new.submitted_at, new.created_at)
       is distinct from (old.reference, old.intake_id, old.form_version_id, old.consent_text_version, old.consented_at,
        old.consent_ip_hash, old.submitted_at, old.created_at) then
      raise exception 'FORBIDDEN' using errcode = '42501', detail = 'Submitted application details cannot be changed.';
    end if;
    if new.status_id is distinct from old.status_id and coalesce(current_setting('app.in_status_rpc', true), '') <> 'on' then
      raise exception 'FORBIDDEN' using errcode = '42501', detail = 'Use the status change action.';
    end if;
  end if;
  return new;
end $$;
create trigger applications_guard before update on public.applications
  for each row execute function private.application_update_guard();

create trigger admission_forms_touch before update on public.admission_forms for each row execute function private.touch_updated_at();

-- ── Reference numbers: PREFIX-YYYY-XXXXXC (spec §1.10) ───────────────────────
create sequence private.application_ref_seq as bigint minvalue 0 start 0;

-- Keyed 26-bit balanced Feistel network with cycle-walking down to 25 bits: a bijection on
-- [0, 2^25), so outputs are unique and non-sequential. Key from Vault (ref_feistel_key).
create or replace function private.feistel25(p_n bigint, p_key text)
returns bigint language plpgsql immutable set search_path = '' as $$
declare v bigint := p_n; l bigint; r bigint; f bigint; t bigint;
begin
  loop
    l := (v >> 13) & 8191;
    r := v & 8191;
    for i in 1..4 loop
      f := (('x' || substr(encode(extensions.hmac(i::text || ':' || r::text, p_key, 'sha256'), 'hex'), 1, 8))::bit(32)::int & 8191)::bigint;
      t := r;
      r := l # f;
      l := t;
    end loop;
    v := (l << 13) | r;
    exit when v < 33554432;  -- 2^25
  end loop;
  return v;
end $$;

create or replace function private.crockford(p_n bigint, p_len int)
returns text language plpgsql immutable set search_path = '' as $$
declare a text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; s text := ''; v bigint := p_n;
begin
  for i in 1..p_len loop
    s := substr(a, (v % 32)::int + 1, 1) || s;
    v := v / 32;
  end loop;
  return s;
end $$;

-- Luhn mod N (N = 32) check character: catches every single-character error and most swaps.
create or replace function private.luhn32_check(p_body text)
returns text language plpgsql immutable set search_path = '' as $$
declare a text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; factor int := 2; total int := 0; addend int;
begin
  for i in reverse length(p_body)..1 loop
    addend := factor * (strpos(a, substr(p_body, i, 1)) - 1);
    factor := case when factor = 2 then 1 else 2 end;
    total := total + addend / 32 + addend % 32;
  end loop;
  return substr(a, ((32 - total % 32) % 32) + 1, 1);
end $$;

create or replace function private.reference_checksum_ok(p_reference text)
returns boolean language sql immutable set search_path = '' as $$
  select p_reference ~ '^[A-Z]{2,4}-[0-9]{4}-[0-9A-HJKMNP-TV-Z]{6}$'
     and private.luhn32_check(substr(right(p_reference, 6), 1, 5)) = right(p_reference, 1)
$$;

create or replace function private.next_application_reference(p_prefix text, p_at timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_n bigint := nextval('private.application_ref_seq');
  v_body text;
  v_tz text := coalesce((select s.data -> 'locale' ->> 'timezone' from public.site_settings s where s.id = 1), 'Africa/Kampala');
begin
  if p_prefix !~ '^[A-Z]{2,4}$' then raise exception 'VALIDATION' using errcode = '22023'; end if;
  if v_n >= 33554432 then raise exception 'REF_SPACE_EXHAUSTED' using errcode = 'P0001'; end if;
  v_body := private.crockford(private.feistel25(v_n, private.secret('ref_feistel_key')), 5);
  return p_prefix || '-' || to_char(p_at at time zone v_tz, 'YYYY') || '-' || v_body || private.luhn32_check(v_body);
end $$;
revoke all on function private.next_application_reference(text, timestamptz) from public, anon, authenticated;

-- ── RLS (spec §3.7) ───────────────────────────────────────────────────────────
alter table public.admission_forms enable row level security;
alter table public.admission_form_versions enable row level security;
alter table public.admission_intake_classes enable row level security;
alter table public.admission_statuses enable row level security;
alter table public.applications enable row level security;
alter table public.application_medical enable row level security;
alter table public.application_upload_sessions enable row level security;  -- RPC-only: no policies
alter table public.application_documents enable row level security;
alter table public.admission_status_history enable row level security;
alter table public.admission_notes enable row level security;
alter table public.admission_info_requests enable row level security;

create policy admission_forms_select on public.admission_forms for select to authenticated
  using ((select public.has_permission('admissions.view')));
create policy admission_forms_insert on public.admission_forms for insert to authenticated
  with check ((select public.has_permission('admissions.manage')));
create policy admission_forms_update on public.admission_forms for update to authenticated
  using ((select public.has_permission('admissions.manage')))
  with check ((select public.has_permission('admissions.manage')));
create policy admission_forms_delete on public.admission_forms for delete to authenticated
  using ((select public.has_permission('admissions.manage')));

create policy form_versions_select on public.admission_form_versions for select to anon, authenticated
  using ((select public.has_permission('admissions.view'))
         or exists (select 1 from public.admission_intakes i where i.form_version_id = admission_form_versions.id
                    and i.status = 'published' and i.publish_at <= now() and i.deleted_at is null));
create policy form_versions_insert on public.admission_form_versions for insert to authenticated
  with check ((select public.has_permission('admissions.manage')));
create policy form_versions_update on public.admission_form_versions for update to authenticated
  using ((select public.has_permission('admissions.manage')) and published_at is null)
  with check ((select public.has_permission('admissions.manage')));

-- Intakes follow the LC template with admissions.* permissions; transitions need admissions.manage.
select private.apply_lc_policies('public.admission_intakes', 'admissions');
drop policy admission_intakes_insert on public.admission_intakes;
create policy admission_intakes_insert on public.admission_intakes for insert to authenticated
  with check ((select public.has_permission('admissions.manage')));
drop policy admission_intakes_update on public.admission_intakes;
create policy admission_intakes_update on public.admission_intakes for update to authenticated
  using ((select public.has_permission('admissions.manage')))
  with check ((select public.has_permission('admissions.manage')));
drop policy admission_intakes_delete on public.admission_intakes;
create policy admission_intakes_delete on public.admission_intakes for delete to authenticated
  using (deleted_at is not null and (select public.has_permission('admissions.manage')));

create policy intake_classes_select on public.admission_intake_classes for select to anon, authenticated
  using ((select public.has_permission('admissions.view'))
         or exists (select 1 from public.admission_intakes i where i.id = intake_id
                    and i.status = 'published' and i.publish_at <= now() and i.deleted_at is null));
create policy intake_classes_insert on public.admission_intake_classes for insert to authenticated
  with check ((select public.has_permission('admissions.manage')));
create policy intake_classes_update on public.admission_intake_classes for update to authenticated
  using ((select public.has_permission('admissions.manage')))
  with check ((select public.has_permission('admissions.manage')));
create policy intake_classes_delete on public.admission_intake_classes for delete to authenticated
  using ((select public.has_permission('admissions.manage')));

create policy statuses_select on public.admission_statuses for select to authenticated
  using ((select public.has_permission('admissions.view')));
create policy statuses_insert on public.admission_statuses for insert to authenticated
  with check ((select public.has_permission('admissions.manage')));
create policy statuses_update on public.admission_statuses for update to authenticated
  using ((select public.has_permission('admissions.manage')))
  with check ((select public.has_permission('admissions.manage')));
create policy statuses_delete on public.admission_statuses for delete to authenticated
  using ((select public.has_permission('admissions.manage')));

create policy applications_select on public.applications for select to authenticated
  using ((select public.has_permission('admissions.view')) and (select private.mfa_satisfied()));
create policy applications_update on public.applications for update to authenticated
  using ((select public.has_permission('admissions.edit')) and (select private.mfa_satisfied()))
  with check ((select public.has_permission('admissions.edit')) and (select private.mfa_satisfied()));

create policy application_medical_select on public.application_medical for select to authenticated
  using ((select public.has_permission('admissions.view')) and (select public.has_permission('admissions.view_medical'))
         and (select private.mfa_satisfied()));

create policy application_documents_select on public.application_documents for select to authenticated
  using ((select public.has_permission('admissions.view')) and (select private.mfa_satisfied()));
create policy application_documents_review on public.application_documents for update to authenticated
  using ((select public.has_permission('admissions.edit')) and (select private.mfa_satisfied()))
  with check ((select public.has_permission('admissions.edit')) and (select private.mfa_satisfied()));

create policy status_history_select on public.admission_status_history for select to authenticated
  using ((select public.has_permission('admissions.view')) and (select private.mfa_satisfied()));

create policy admission_notes_select on public.admission_notes for select to authenticated
  using ((select public.has_permission('admissions.view_notes')) and (select private.mfa_satisfied()));
create policy admission_notes_insert on public.admission_notes for insert to authenticated
  with check ((select public.has_permission('admissions.view_notes')) and (select private.mfa_satisfied()));

create policy info_requests_select on public.admission_info_requests for select to authenticated
  using ((select public.has_permission('admissions.view')) and (select private.mfa_satisfied()));
