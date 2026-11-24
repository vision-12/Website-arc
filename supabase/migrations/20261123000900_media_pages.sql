-- Media library and CMS pages (spec §1.3, §1.4, §3.1, §3.4).

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind public.media_kind not null,
  bucket text not null check (bucket in ('media', 'resources')),
  path text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'),
  original_filename text check (char_length(original_filename) <= 200),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
                                                'image/svg+xml', 'application/pdf')),
  size_bytes bigint not null check (size_bytes > 0),
  width integer check (width > 0),
  height integer check (height > 0),
  alt_text text check (char_length(alt_text) <= 250),
  caption text check (char_length(caption) <= 500),
  lqip text check (char_length(lqip) <= 1500),
  blurhash text check (char_length(blurhash) <= 100),
  uploaded_by uuid references public.profiles (id) on delete set null,
  replaced_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_assets_kind_created_idx on public.media_assets (kind, created_at desc);
create index media_assets_uploaded_by_idx on public.media_assets (uploaded_by);
create index media_assets_deleted_by_idx on public.media_assets (deleted_by);
create index media_assets_search_idx on public.media_assets
  using gin ((coalesce(original_filename, '') || ' ' || coalesce(alt_text, '')) extensions.gin_trgm_ops);
create trigger media_assets_touch before update on public.media_assets for each row execute function private.touch_updated_at();

create table public.media_usages (
  media_id uuid not null references public.media_assets (id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  field text not null,
  primary key (media_id, entity_type, entity_id, field)
);
create index media_usages_entity_idx on public.media_usages (entity_type, entity_id);

create or replace function private.module_of(p_entity_type text)
returns text language sql immutable set search_path = '' as $$
  select case p_entity_type
    when 'pages' then 'pages' when 'news_articles' then 'news' when 'events' then 'events'
    when 'gallery_albums' then 'gallery' when 'gallery_items' then 'gallery' when 'staff_profiles' then 'staff'
    when 'resources' then 'resources' when 'site_settings' then 'appearance'
    when 'academic_levels' then 'academics' when 'academic_programmes' then 'academics'
    when 'departments' then 'academics' when 'subjects' then 'academics' when 'co_curricular_activities' then 'academics'
    else 'none' end
$$;
grant execute on function private.module_of(text) to authenticated;

-- An image cannot be placed on the website without a description (MP §5.9).
create or replace function private.media_usage_requires_alt()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.media_assets m where m.id = new.media_id and m.kind = 'image'
             and coalesce(trim(m.alt_text), '') = '') then
    raise exception 'ALT_TEXT_REQUIRED' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger media_usages_alt before insert on public.media_usages
  for each row execute function private.media_usage_requires_alt();

create or replace function private.media_trash_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if private.is_end_user() and not public.has_permission('media.delete') then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
    if exists (select 1 from public.media_usages u where u.media_id = new.id) then
      raise exception 'MEDIA_IN_USE' using errcode = '23503';
    end if;
    new.deleted_by := (select auth.uid());
  end if;
  new.version := old.version + 1;
  return new;
end $$;
create trigger media_assets_trash before update on public.media_assets
  for each row execute function private.media_trash_guard();

alter table public.media_assets enable row level security;
alter table public.media_usages enable row level security;
-- Anon reads only presentation columns (no filenames, uploader ids).
revoke select on public.media_assets from anon;
grant select (id, kind, bucket, path, mime_type, width, height, alt_text, caption, lqip, blurhash, deleted_at)
  on public.media_assets to anon;
create policy media_assets_select on public.media_assets for select to anon, authenticated
  using (deleted_at is null or (select public.has_permission('media.view')));
create policy media_assets_insert on public.media_assets for insert to authenticated
  with check ((select public.has_permission('media.create')) and uploaded_by = (select auth.uid()));
create policy media_assets_update on public.media_assets for update to authenticated
  using ((select public.has_permission('media.edit')) or (select public.has_permission('media.delete')))
  with check ((select public.has_permission('media.edit')) or (select public.has_permission('media.delete')));
create policy media_assets_delete on public.media_assets for delete to authenticated
  using (deleted_at is not null and (select public.has_permission('trash.purge')));
create policy media_usages_select on public.media_usages for select to authenticated
  using ((select public.has_permission('media.view')));
create policy media_usages_insert on public.media_usages for insert to authenticated
  with check (public.has_permission(private.module_of(entity_type) || '.edit'));
create policy media_usages_update on public.media_usages for update to authenticated
  using (public.has_permission(private.module_of(entity_type) || '.edit'))
  with check (public.has_permission(private.module_of(entity_type) || '.edit'));
create policy media_usages_delete on public.media_usages for delete to authenticated
  using (public.has_permission(private.module_of(entity_type) || '.edit'));

-- ── Pages ─────────────────────────────────────────────────────────────────────
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.pages (id) on delete restrict,
  title text not null check (char_length(title) between 2 and 150),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 120),
  path text not null default '',
  body jsonb not null default '{"type":"doc","content":[]}',
  body_text text not null default '',
  excerpt text check (char_length(excerpt) <= 300),
  layout public.page_layout not null default 'default',
  show_in_nav boolean not null default false,
  nav_order integer not null default 0,
  system_key text unique,
  seo jsonb not null default '{}',
  cover_media_id uuid references public.media_assets (id) on delete set null,
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', body_text), 'C')) stored,
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
  check (status not in ('scheduled', 'published') or publish_at is not null)
);
create unique index pages_path_live_idx on public.pages (path) where deleted_at is null;
create index pages_parent_idx on public.pages (parent_id);
create index pages_publish_idx on public.pages (publish_at desc) where status = 'published' and deleted_at is null;
create index pages_search_idx on public.pages using gin (search);
create index pages_cover_idx on public.pages (cover_media_id);
create index pages_created_by_idx on public.pages (created_by);
create index pages_updated_by_idx on public.pages (updated_by);
create index pages_deleted_by_idx on public.pages (deleted_by);

-- Materialised path, depth ≤ 3, reserved top-level segments (spec §1.4). Runs before the lifecycle trigger.
create or replace function private.page_path_maintain()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_parent_path text; v_depth int;
begin
  if new.parent_id is null then
    if new.system_key is null and new.slug = any (array['search', 'admin', 'api', 'preview', 'login', 'news', 'events',
        'gallery', 'staff', 'resources', 'contact', 'admissions', 'academics', 'legal', 'about', 'theme-css', 'mfa']) then
      raise exception 'VALIDATION' using errcode = '22023', detail = format('"%s" is reserved for a built-in section', new.slug);
    end if;
    new.path := '/' || new.slug;
  else
    select path into v_parent_path from public.pages where id = new.parent_id;
    new.path := v_parent_path || '/' || new.slug;
  end if;
  v_depth := array_length(string_to_array(trim(both '/' from new.path), '/'), 1);
  if v_depth > 3 then
    raise exception 'VALIDATION' using errcode = '22023', detail = 'Pages can be nested at most three levels deep.';
  end if;
  return new;
end $$;
create trigger pages_10_path before insert or update of slug, parent_id on public.pages
  for each row execute function private.page_path_maintain();

-- Keep children's paths in step when a parent's path changes.
create or replace function private.page_path_cascade()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.path is distinct from old.path then
    update public.pages set parent_id = parent_id where parent_id = new.id;
  end if;
  return null;
end $$;
create trigger pages_30_path_cascade after update of path on public.pages
  for each row execute function private.page_path_cascade();

select private.apply_lc_policies('public.pages', 'pages');
