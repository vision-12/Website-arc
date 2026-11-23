-- Contact enquiries (spec §1.9, §3.6). Public submissions arrive through submit_enquiry (Phase 11).

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email extensions.citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone_e164 text check (phone_e164 ~ '^\+[1-9]\d{7,14}$'),
  subject text not null check (char_length(subject) between 2 and 60),
  message text not null check (char_length(message) between 20 and 2000),
  status public.enquiry_status not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  replied_at timestamptz,
  ip_hash text,
  consent_text_version text not null,
  consented_at timestamptz not null,
  deleted_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);
create index contact_messages_assigned_idx on public.contact_messages (assigned_to);
create index contact_messages_created_idx on public.contact_messages (created_at);

create table public.enquiry_notes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.contact_messages (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index enquiry_notes_message_idx on public.enquiry_notes (message_id);
create index enquiry_notes_author_idx on public.enquiry_notes (author_id);

-- Staff may only triage an enquiry; the visitor's words are immutable.
create or replace function private.contact_message_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  if private.is_end_user() then
    if (new.name, new.email, new.phone_e164, new.subject, new.message, new.ip_hash, new.consent_text_version, new.consented_at, new.created_at)
       is distinct from (old.name, old.email, old.phone_e164, old.subject, old.message, old.ip_hash, old.consent_text_version, old.consented_at, old.created_at) then
      raise exception 'FORBIDDEN' using errcode = '42501', detail = 'Enquiry content cannot be edited.';
    end if;
    if new.deleted_at is distinct from old.deleted_at and not public.has_permission('enquiries.delete') then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger contact_messages_guard before update on public.contact_messages
  for each row execute function private.contact_message_guard();

create or replace function private.set_author()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_end_user() then new.author_id := (select auth.uid()); end if;
  return new;
end $$;
create trigger enquiry_notes_author before insert on public.enquiry_notes
  for each row execute function private.set_author();

alter table public.contact_messages enable row level security;
alter table public.enquiry_notes enable row level security;
create policy contact_messages_select on public.contact_messages for select to authenticated
  using ((select public.has_permission('enquiries.view')) and (select private.mfa_satisfied()));
create policy contact_messages_update on public.contact_messages for update to authenticated
  using (((select public.has_permission('enquiries.edit')) or (select public.has_permission('enquiries.delete')))
         and (select private.mfa_satisfied()))
  with check (((select public.has_permission('enquiries.edit')) or (select public.has_permission('enquiries.delete')))
         and (select private.mfa_satisfied()));
create policy enquiry_notes_select on public.enquiry_notes for select to authenticated
  using ((select public.has_permission('enquiries.view')) and (select private.mfa_satisfied()));
create policy enquiry_notes_insert on public.enquiry_notes for insert to authenticated
  with check ((select public.has_permission('enquiries.edit')) and (select private.mfa_satisfied()));
