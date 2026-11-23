-- Outbound email queue and suppression list (spec D8, §1.11).

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  to_email extensions.citext not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}',
  status public.email_status not null default 'queued',
  resend_id text unique,
  attempts smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text check (char_length(last_error) <= 500),
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_messages_queue_idx on public.email_messages (status, next_attempt_at);
create index email_messages_entity_idx on public.email_messages (entity_type, entity_id);

create table public.email_suppressions (
  email_hash text primary key,
  reason text not null check (reason in ('bounce', 'complaint', 'manual')),
  created_at timestamptz not null default now()
);

alter table public.email_messages enable row level security;
alter table public.email_suppressions enable row level security;
create policy email_messages_select on public.email_messages for select to authenticated
  using ((entity_type = 'application' and (select public.has_permission('admissions.view')) and (select private.mfa_satisfied()))
         or (entity_type = 'enquiry' and (select public.has_permission('enquiries.view')) and (select private.mfa_satisfied()))
         or (select public.has_permission('settings.manage')));
create policy email_suppressions_select on public.email_suppressions for select to authenticated
  using ((select public.has_permission('settings.manage')));
