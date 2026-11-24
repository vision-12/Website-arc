-- Site configuration, redirects and autosave working copies (spec §1.3, §3.4).

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  version integer not null default 1,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index site_settings_updated_by_idx on public.site_settings (updated_by);

-- Internal values that must not be publicly readable (inbox addresses, retention periods).
create table public.site_settings_private (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  version integer not null default 1,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index site_settings_private_updated_by_idx on public.site_settings_private (updated_by);

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique check (from_path ~ '^/[^?#]*$'),
  to_path text not null check (to_path ~ '^(/|https://)'),
  status_code smallint not null default 308 check (status_code in (301, 302, 307, 308)),
  source public.redirect_source not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_path <> to_path)
);
create index redirects_created_by_idx on public.redirects (created_by);
create index redirects_to_path_idx on public.redirects (to_path);

create table public.content_drafts (
  entity_type text not null check (entity_type in ('pages', 'news', 'academics', 'events', 'gallery', 'staff', 'resources')),
  entity_id uuid not null,
  data jsonb not null,
  base_version integer not null,
  updated_by uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);
create index content_drafts_updated_by_idx on public.content_drafts (updated_by);

create trigger site_settings_audit after update on public.site_settings
  for each row execute function private.audit_sensitive_change();

-- AAL2 is required when the user holds a requires_mfa role, or the school requires MFA for all admins.
create or replace function private.mfa_satisfied()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
      or (
        not private.user_requires_mfa()
        and not coalesce((select (s.data -> 'features' ->> 'mfaRequiredForAdmins')::boolean
                          from public.site_settings s where s.id = 1), false)
      )
$$;
grant execute on function private.mfa_satisfied() to anon, authenticated, service_role;

create or replace function private.feature_enabled(p_flag text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (s.data -> 'features' ->> p_flag)::boolean from public.site_settings s where s.id = 1), false)
$$;

alter table public.site_settings enable row level security;
alter table public.site_settings_private enable row level security;
alter table public.redirects enable row level security;
alter table public.content_drafts enable row level security;

create policy site_settings_select on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_private_select on public.site_settings_private for select to authenticated
  using ((select public.has_permission('settings.view')));
create policy redirects_select on public.redirects for select to anon, authenticated using (true);
create policy redirects_insert on public.redirects for insert to authenticated
  with check ((select public.has_permission('settings.manage')));
create policy redirects_update on public.redirects for update to authenticated
  using ((select public.has_permission('settings.manage')))
  with check ((select public.has_permission('settings.manage')));
create policy redirects_delete on public.redirects for delete to authenticated
  using ((select public.has_permission('settings.manage')));
-- Row-dependent permission (entity_type → module); the table is tiny.
create policy content_drafts_all on public.content_drafts for all to authenticated
  using (public.has_permission(entity_type || '.edit'))
  with check (public.has_permission(entity_type || '.edit') and updated_by = (select auth.uid()));

-- Settings are written only through this RPC: per-section permission + optimistic concurrency.
create or replace function public.update_site_settings(p_section text, p_value jsonb, p_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_perm text; v_version integer;
begin
  v_perm := case
    when p_section in ('identity', 'theme', 'navigation', 'homepage', 'footer', 'social', 'seo') then 'appearance.manage'
    when p_section in ('contact', 'admissions', 'locale', 'features', 'attribution', 'content', 'legal') then 'settings.manage'
  end;
  if v_perm is null then raise exception 'VALIDATION' using errcode = '22023', detail = 'Unknown settings section.'; end if;
  if not public.has_permission(v_perm) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.site_settings
     set data = jsonb_set(data, array[p_section], p_value, true), version = version + 1,
         updated_by = (select auth.uid()), updated_at = now()
   where id = 1 and version = p_version
  returning version into v_version;
  if v_version is null then raise exception 'CONFLICT' using errcode = '40001'; end if;
  return v_version;
end $$;
revoke all on function public.update_site_settings(text, jsonb, integer) from public;
grant execute on function public.update_site_settings(text, jsonb, integer) to authenticated;

create or replace function public.update_private_settings(p_value jsonb, p_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_version integer;
begin
  if not public.has_permission('settings.manage') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.site_settings_private
     set data = p_value, version = version + 1, updated_by = (select auth.uid()), updated_at = now()
   where id = 1 and version = p_version
  returning version into v_version;
  if v_version is null then raise exception 'CONFLICT' using errcode = '40001'; end if;
  return v_version;
end $$;
revoke all on function public.update_private_settings(jsonb, integer) from public;
grant execute on function public.update_private_settings(jsonb, integer) to authenticated;
