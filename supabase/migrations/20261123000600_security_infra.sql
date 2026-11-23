-- Submission tickets (D5), rate limiting (D9), secrets from Vault, retention log.

create or replace function private.secret(p_name text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  select decrypted_secret into v from vault.decrypted_secrets where name = p_name;
  if v is null then raise exception 'SECRET_MISSING' using errcode = 'P0001', detail = p_name; end if;
  return v;
end $$;
revoke all on function private.secret(text) from public, anon, authenticated;

create table private.submission_tickets_used (
  ticket_hash bytea primary key,
  used_at timestamptz not null default now()
);
create unlogged table private.rate_limit_buckets (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
alter table private.submission_tickets_used enable row level security;
alter table private.rate_limit_buckets enable row level security;
revoke all on private.submission_tickets_used, private.rate_limit_buckets from anon, authenticated;

-- Verifies a server-minted HMAC ticket (spec D5). The server signs
--   purpose . sha256(payload) . issuedAt . ipHash
-- with FORM_SIGNING_SECRET (mirrored in Vault as form_signing_secret). Valid for 120 s, single use.
create or replace function private.verify_ticket(p_purpose text, p_payload text, p_ticket jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_issued bigint;
  v_now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_expected text;
begin
  v_issued := nullif(p_ticket ->> 'issuedAt', '')::bigint;
  if v_issued is null or abs(v_now_ms - v_issued) > 120000 then
    raise exception 'TICKET_INVALID' using errcode = '42501', detail = 'expired';
  end if;
  v_expected := encode(extensions.hmac(
    p_purpose || '.' || encode(extensions.digest(p_payload, 'sha256'), 'hex') || '.' || (p_ticket ->> 'issuedAt') || '.' || coalesce(p_ticket ->> 'ipHash', ''),
    private.secret('form_signing_secret'), 'sha256'), 'hex');
  if p_ticket ->> 'mac' is null or v_expected <> p_ticket ->> 'mac' then
    raise exception 'TICKET_INVALID' using errcode = '42501', detail = 'signature';
  end if;
  begin
    insert into private.submission_tickets_used (ticket_hash) values (extensions.digest(p_ticket ->> 'mac', 'sha256'));
  exception when unique_violation then
    raise exception 'TICKET_INVALID' using errcode = '42501', detail = 'replayed';
  end;
end $$;
revoke all on function private.verify_ticket(text, text, jsonb) from public, anon, authenticated;

-- Fixed-window counter. Raises RATE_LIMITED (SQLSTATE PT429) once `p_max` is exceeded.
create or replace function private.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into private.rate_limit_buckets as b (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = b.count + 1
  returning count into v_count;
  if v_count > p_max then
    raise exception 'RATE_LIMITED' using errcode = 'PT429';
  end if;
end $$;
revoke all on function private.rate_limit_hit(text, integer, integer) from public, anon, authenticated;

-- Login / password-reset throttling (spec §4.7). Ticket-gated so a third party cannot exhaust a
-- victim's per-email budget by calling the RPC directly with the public key.
create or replace function public.rate_limit_check_auth(p_ticket jsonb, p_payload text)
returns void language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform private.verify_ticket('auth', p_payload, p_ticket);
  v := p_payload::jsonb;
  case v ->> 'action'
    when 'login' then
      perform private.rate_limit_hit('login:ip:' || (p_ticket ->> 'ipHash'), 5, 900);
      perform private.rate_limit_hit('login:email:' || (v ->> 'emailHash'), 10, 3600);
    when 'reset' then
      perform private.rate_limit_hit('reset:ip:' || (p_ticket ->> 'ipHash'), 3, 3600);
      perform private.rate_limit_hit('reset:email:' || (v ->> 'emailHash'), 3, 3600);
    else
      raise exception 'VALIDATION' using errcode = '22023';
  end case;
end $$;
revoke all on function public.rate_limit_check_auth(jsonb, text) from public;
grant execute on function public.rate_limit_check_auth(jsonb, text) to anon, authenticated;

create table public.retention_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb
);
alter table public.retention_runs enable row level security;
create policy retention_runs_select on public.retention_runs for select to authenticated
  using ((select public.has_permission('settings.view')));

-- Housekeeping, called hourly by /api/cron/housekeeping.
create or replace function public.housekeeping()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_buckets int; v_tickets int;
begin
  delete from private.rate_limit_buckets where window_start < now() - interval '1 day';
  get diagnostics v_buckets = row_count;
  delete from private.submission_tickets_used where used_at < now() - interval '10 minutes';
  get diagnostics v_tickets = row_count;
  return jsonb_build_object('rate_limit_buckets', v_buckets, 'tickets', v_tickets);
end $$;
revoke all on function public.housekeeping() from public, anon, authenticated;
grant execute on function public.housekeeping() to service_role;
