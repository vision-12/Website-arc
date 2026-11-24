-- Foundation: schemas, extensions, default privileges, shared trigger helpers (spec §0 D1, §3.0).

create schema if not exists private;
revoke all on schema private from public;
-- Policies call private.* helpers, so API roles need USAGE. The schema is NOT exposed through PostgREST.
grant usage on schema private to anon, authenticated, service_role;

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Anon never writes base tables directly (spec §3.0); public writes go through definer RPCs.
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;
-- Functions are not callable by API roles unless a migration grants it explicitly.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- True when the current request comes from an end user (anon/authenticated JWT), false for the
-- system: migrations, seeds, service-role jobs and cron. Guards enforce rules only for end users.
create or replace function private.is_end_user()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((select auth.role()) in ('anon', 'authenticated'), false)
$$;
grant execute on function private.is_end_user() to anon, authenticated, service_role;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Append-only tables (spec §1.13). Only the retention job may delete, by setting app.retention_purge.
create or replace function private.forbid_update_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('app.retention_purge', true) = 'on' and not private.is_end_user() then
    return old;
  end if;
  raise exception 'APPEND_ONLY' using errcode = 'P0001', detail = format('%s is append-only', tg_table_name);
end $$;
