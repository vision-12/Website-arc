-- CMS core (Phase 4, docs/plan/phase-04.md §5): per-person working copies (P4-D, ADR-005), "used in"
-- tracking in the database (P4-E), page-tree rules, checked uploads (P4-G, ADR-018), scheduled
-- publishing and the dashboard/editor helpers (P4-A, P4-K).

-- ── Working copies: one per person (P4-D) ─────────────────────────────────────────────────────────
alter table public.content_drafts drop constraint content_drafts_pkey;
alter table public.content_drafts add constraint content_drafts_pkey primary key (entity_type, entity_id, updated_by);
alter table public.content_drafts add constraint content_drafts_data_size_chk check (octet_length(data::text) <= 300000);

drop policy content_drafts_all on public.content_drafts;
-- Row-dependent permission (entity_type → module); the table is tiny. Only your own copy, ever.
create policy content_drafts_select on public.content_drafts for select to authenticated
  using (updated_by = (select auth.uid()) and public.has_permission(entity_type || '.edit'));
create policy content_drafts_insert on public.content_drafts for insert to authenticated
  with check (updated_by = (select auth.uid()) and public.has_permission(entity_type || '.edit'));
create policy content_drafts_update on public.content_drafts for update to authenticated
  using (updated_by = (select auth.uid()) and public.has_permission(entity_type || '.edit'))
  with check (updated_by = (select auth.uid()) and public.has_permission(entity_type || '.edit'));
create policy content_drafts_delete on public.content_drafts for delete to authenticated
  using (updated_by = (select auth.uid()) and public.has_permission(entity_type || '.edit'));

-- Autosave: upsert the caller's copy, at most once per 5 seconds per item (spec §4.1).
-- Returns the save time, or null when the previous save was too recent.
create or replace function public.save_working_copy(p_entity_type text, p_entity_id uuid, p_base_version integer,
                                                    p_data jsonb)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare v_at timestamptz;
begin
  insert into public.content_drafts as d (entity_type, entity_id, data, base_version, updated_by, updated_at)
  values (p_entity_type, p_entity_id, p_data, p_base_version, (select auth.uid()), now())
  on conflict (entity_type, entity_id, updated_by) do update
    set data = excluded.data, base_version = excluded.base_version, updated_at = excluded.updated_at
    where d.updated_at < now() - interval '5 seconds'
  returning d.updated_at into v_at;
  return v_at;
end $$;
revoke all on function public.save_working_copy(text, uuid, integer, jsonb) from public, anon;
grant execute on function public.save_working_copy(text, uuid, integer, jsonb) to authenticated;

-- Who else has unsaved changes to an item ("Sarah is also editing"): names and times, never text.
create or replace function public.content_editors(p_entity_type text, p_entity_id uuid)
returns table (user_id uuid, full_name text, updated_at timestamptz, base_version integer)
language sql stable security definer set search_path = '' as $$
  select d.updated_by, p.full_name, d.updated_at, d.base_version
    from public.content_drafts d
    join public.profiles p on p.id = d.updated_by
   where public.has_permission(p_entity_type || '.edit')
     and d.entity_type = p_entity_type and d.entity_id = p_entity_id
     and d.updated_by <> (select auth.uid())
   order by d.updated_at desc
$$;
revoke all on function public.content_editors(text, uuid) from public, anon;
grant execute on function public.content_editors(text, uuid) to authenticated;

-- ── Rich text helpers (Tiptap JSON) ───────────────────────────────────────────────────────────────
-- Searchable plain text of a document.
create or replace function private.rich_text_plain(p_doc jsonb)
returns text language sql immutable set search_path = '' as $$
  select coalesce(trim(regexp_replace(string_agg(t #>> '{}', ' '), '\s+', ' ', 'g')), '')
    from jsonb_path_query(coalesce(p_doc, '{}'::jsonb), 'strict $.** ? (@.type == "text").text') t
$$;

-- Every media id a document refers to: image nodes and PDF links both carry attrs.mediaId (P4-F).
create or replace function private.rich_text_media_ids(p_doc jsonb)
returns uuid[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct (v #>> '{}')::uuid), '{}'::uuid[])
    from jsonb_path_query(coalesce(p_doc, '{}'::jsonb), 'strict $.** ? (exists (@.mediaId)).mediaId') v
   where jsonb_typeof(v) = 'string'
     and (v #>> '{}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

-- ── "Used in" tracking (P4-E) ─────────────────────────────────────────────────────────────────────
-- Replaces one field's usages. Only checked uploads count; unknown ids are ignored (the renderer drops
-- them). media_usages_alt raises ALT_TEXT_REQUIRED for an undescribed photo, failing the whole save.
create or replace function private.sync_media_usages(p_entity_type text, p_entity_id uuid, p_field text,
                                                     p_media_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[];
begin
  select coalesce(array_agg(m.id), '{}'::uuid[]) into v_ids
    from public.media_assets m
   where m.id = any (coalesce(p_media_ids, '{}'::uuid[])) and m.confirmed_at is not null;
  delete from public.media_usages u
   where u.entity_type = p_entity_type and u.entity_id = p_entity_id and u.field = p_field
     and not (u.media_id = any (v_ids));
  insert into public.media_usages (media_id, entity_type, entity_id, field)
    select id, p_entity_type, p_entity_id, p_field from unnest(v_ids) as id
  on conflict do nothing;
end $$;

create or replace function private.page_body_text()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.body_text := private.rich_text_plain(new.body);
  return new;
end $$;
create trigger pages_15_body_text before insert or update of body on public.pages
  for each row execute function private.page_body_text();

create or replace function private.page_media_usages()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_og text := new.seo ->> 'ogImageMediaId';
begin
  if tg_op = 'INSERT' or new.body is distinct from old.body then
    perform private.sync_media_usages('pages', new.id, 'body', private.rich_text_media_ids(new.body));
  end if;
  if tg_op = 'INSERT' or new.cover_media_id is distinct from old.cover_media_id then
    perform private.sync_media_usages('pages', new.id, 'cover', array_remove(array[new.cover_media_id], null));
  end if;
  if tg_op = 'INSERT' or v_og is distinct from (old.seo ->> 'ogImageMediaId') then
    perform private.sync_media_usages('pages', new.id, 'seo.ogImage',
      case when v_og ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then array[v_og::uuid] else '{}'::uuid[] end);
  end if;
  return null;
end $$;
create trigger pages_40_media_usages after insert or update of body, cover_media_id, seo on public.pages
  for each row execute function private.page_media_usages();

-- A purged item releases its media and its working copies. TG_ARGV[0] = content_drafts entity type.
create or replace function private.content_purge_cleanup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.media_usages where entity_type = tg_table_name and entity_id = old.id;
  delete from public.content_drafts where entity_type = tg_argv[0] and entity_id = old.id;
  return old;
end $$;
create trigger pages_50_purge_cleanup after delete on public.pages
  for each row execute function private.content_purge_cleanup('pages');

-- ── Page tree rules ───────────────────────────────────────────────────────────────────────────────
-- Built-in pages (system_key) can be edited but not created, moved, renamed or trashed by people;
-- a page can't go inside itself; Trash can't strand sub-pages. Runs before the path trigger.
create or replace function private.page_structure_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_end_user() then return new; end if;

  if tg_op = 'INSERT' then
    if new.system_key is not null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  else
    if new.system_key is distinct from old.system_key then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
    if old.system_key is not null and (new.slug <> old.slug or new.parent_id is distinct from old.parent_id
        or (new.deleted_at is not null and old.deleted_at is null)) then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = 'This is a built-in page. You can edit it, but not move, rename or delete it.';
    end if;
    if new.deleted_at is not null and old.deleted_at is null
       and exists (select 1 from public.pages c where c.parent_id = new.id and c.deleted_at is null) then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = 'This page has sub-pages. Move them, or move them to Trash, first.';
    end if;
    if new.deleted_at is null and old.deleted_at is not null and new.parent_id is not null
       and exists (select 1 from public.pages p where p.id = new.parent_id and p.deleted_at is not null) then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = 'The page above this one is in Trash. Restore that page first.';
    end if;
  end if;

  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    if exists (select 1 from public.pages p where p.id = new.parent_id and p.deleted_at is not null) then
      raise exception 'VALIDATION' using errcode = '22023', detail = 'Pages can''t be placed under a page in Trash.';
    end if;
    if tg_op = 'UPDATE' and exists (
      with recursive up (id, parent_id, depth) as (
        select p.id, p.parent_id, 1 from public.pages p where p.id = new.parent_id
        union all
        select p.id, p.parent_id, up.depth + 1 from public.pages p join up on p.id = up.parent_id where up.depth < 10
      )
      select 1 from up where up.id = new.id) then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = 'A page can''t be moved inside itself or one of its sub-pages.';
    end if;
  end if;
  return new;
end $$;
create trigger pages_05_structure before insert or update on public.pages
  for each row execute function private.page_structure_guard();

-- Menu order among siblings, in one statement and as the caller (RLS and the lifecycle trigger apply:
-- reordering live pages is a publish action, spec §2.3).
create or replace function public.reorder_pages(p_ids uuid[], p_parent uuid default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if cardinality(p_ids) > 500 or exists (
    select 1 from unnest(p_ids) as x (id)
     where not exists (select 1 from public.pages p
                        where p.id = x.id and p.parent_id is not distinct from p_parent and p.deleted_at is null)) then
    raise exception 'VALIDATION' using errcode = '22023',
      detail = 'These pages are no longer in the same place. Reload the page and try again.';
  end if;
  update public.pages p set nav_order = (o.ord * 10)::integer
    from unnest(p_ids) with ordinality as o (id, ord)
   where p.id = o.id and p.nav_order is distinct from (o.ord * 10)::integer;
end $$;
revoke all on function public.reorder_pages(uuid[], uuid) from public, anon;
grant execute on function public.reorder_pages(uuid[], uuid) to authenticated;

-- ── Media: checked uploads (P4-G, ADR-018) ────────────────────────────────────────────────────────
alter table public.media_assets add column confirmed_at timestamptz;
update public.media_assets set confirmed_at = created_at;
create index media_assets_pending_idx on public.media_assets (created_at) where confirmed_at is null;

-- SVG needs a sanitiser before it can be accepted (Phase 5 decides, for logos).
alter table public.media_assets drop constraint media_assets_mime_type_check;
alter table public.media_assets add constraint media_assets_mime_type_check
  check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'application/pdf'));
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'application/pdf']
 where id = 'media';

-- A row made by a browser starts unconfirmed; only the server's check (the confirm step) confirms it,
-- once. System inserts (seeds, provisioning) are trusted. An in-use photo keeps its description.
create or replace function private.media_confirm_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_end_user() then
    if tg_op = 'INSERT' then new.confirmed_at := coalesce(new.confirmed_at, now()); end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.confirmed_at := null;
  elsif old.confirmed_at is not null then
    new.confirmed_at := old.confirmed_at;
  elsif new.confirmed_at is not null then
    new.confirmed_at := now();
  end if;
  if tg_op = 'UPDATE' and new.kind = 'image' and coalesce(trim(new.alt_text), '') = ''
     and exists (select 1 from public.media_usages u where u.media_id = new.id) then
    raise exception 'ALT_TEXT_REQUIRED' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger media_assets_confirm before insert or update on public.media_assets
  for each row execute function private.media_confirm_guard();

-- Public PDF links say how big the file is ("PDF, 240 KB"); a public file's size isn't sensitive.
grant select (size_bytes) on public.media_assets to anon;

drop policy media_assets_select on public.media_assets;
create policy media_assets_select on public.media_assets for select to anon, authenticated
  using ((deleted_at is null and confirmed_at is not null) or (select public.has_permission('media.view')));
-- media.create holders may finish (confirm) their own pending upload, even without media.edit.
drop policy media_assets_update on public.media_assets;
create policy media_assets_update on public.media_assets for update to authenticated
  using ((select public.has_permission('media.edit')) or (select public.has_permission('media.delete'))
         or (confirmed_at is null and uploaded_by = (select auth.uid()) and (select public.has_permission('media.create'))))
  with check ((select public.has_permission('media.edit')) or (select public.has_permission('media.delete'))
         or (uploaded_by = (select auth.uid()) and (select public.has_permission('media.create'))));

-- The caller's own pending upload at this storage path (the confirm step rewrites the file in place).
create or replace function private.media_upload_open(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.media_assets m
                  where m.path = p_name and m.confirmed_at is null and m.uploaded_by = (select auth.uid()))
     and public.has_permission('media.create')
$$;
revoke all on function private.media_upload_open(text) from public, anon;
grant execute on function private.media_upload_open(text) to authenticated;

drop policy media_insert on storage.objects;
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media'
              and ((select public.has_permission('media.create')) or (select public.has_permission('media.edit')))
              and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif|gif|pdf)$');
drop policy media_update on storage.objects;
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and ((select public.has_permission('media.edit')) or private.media_upload_open(name)))
  with check (bucket_id = 'media' and ((select public.has_permission('media.edit')) or private.media_upload_open(name)));
drop policy media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((select public.has_permission('media.delete'))
                                  or (select public.has_permission('trash.purge')) or private.media_upload_open(name)));

-- ── Scheduled publishing (MP §5, spec §4.8) ───────────────────────────────────────────────────────
-- Run by /api/cron/publish with the secret key. Each module phase adds its table here.
create or replace function public.publish_due_content()
returns table (entity_table text, entity_id uuid, path text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with due as (
    update public.pages p set status = 'published'
     where p.status = 'scheduled' and p.publish_at <= now() and p.deleted_at is null
    returning p.id, p.path, p.title
  ), audit as (
    insert into public.activity_logs (source, action, entity_type, entity_id, summary)
    select 'cron', 'pages.publish', 'pages', due.id::text,
           left(format('Published "%s" at its scheduled time', due.title), 500)
      from due
    returning 1
  )
  select 'pages'::text, due.id, due.path from due;
end $$;
revoke all on function public.publish_due_content() from public, anon, authenticated;
grant execute on function public.publish_due_content() to service_role;

-- ── Housekeeping: abandoned uploads (extends the Phase 2 function) ────────────────────────────────
create or replace function public.housekeeping()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_buckets int; v_tickets int; v_pending int; v_orphans jsonb;
begin
  delete from private.rate_limit_buckets where window_start < now() - interval '1 day';
  get diagnostics v_buckets = row_count;
  delete from private.submission_tickets_used where used_at < now() - interval '10 minutes';
  get diagnostics v_tickets = row_count;
  -- Uploads not confirmed within an hour were abandoned or rejected.
  delete from public.media_assets m
   where m.confirmed_at is null and m.created_at < now() - interval '1 hour'
     and not exists (select 1 from public.media_usages u where u.media_id = m.id);
  get diagnostics v_pending = row_count;
  -- Files no media row points at (rejected, replaced or abandoned uploads); the route deletes them
  -- through the Storage API.
  select coalesce(jsonb_agg(o.name), '[]'::jsonb) into v_orphans
    from (select so.name from storage.objects so
           where so.bucket_id = 'media' and so.created_at < now() - interval '1 hour'
             and not exists (select 1 from public.media_assets m where m.path = so.name)
           order by so.created_at
           limit 500) o;
  return jsonb_build_object('rate_limit_buckets', v_buckets, 'tickets', v_tickets,
                            'pending_media', v_pending, 'orphan_media_objects', v_orphans);
end $$;
revoke all on function public.housekeeping() from public, anon, authenticated;
grant execute on function public.housekeeping() to service_role;

-- ── Dashboard and editor helpers (MP §5.10) ───────────────────────────────────────────────────────
-- Counts for the actionable tiles. Security invoker: RLS decides what each person can count.
create or replace function public.get_dashboard_counts()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'pagesInReview', (select count(*) from public.pages where status = 'in_review' and deleted_at is null),
    'pagesScheduledSoon', (select count(*) from public.pages
                            where status = 'scheduled' and deleted_at is null
                              and publish_at <= now() + interval '48 hours'),
    'pagesStaleDrafts', (select count(*) from public.pages
                          where status = 'draft' and deleted_at is null and updated_at < now() - interval '30 days'),
    'mediaMissingAlt', (select count(*) from public.media_assets
                         where kind = 'image' and deleted_at is null and confirmed_at is not null
                           and coalesce(trim(alt_text), '') = ''),
    'trashPages', (select count(*) from public.pages where deleted_at is not null),
    'trashMedia', (select count(*) from public.media_assets where deleted_at is not null)
  )
$$;
revoke all on function public.get_dashboard_counts() from public, anon;
grant execute on function public.get_dashboard_counts() to authenticated;

-- Colleagues' names ("Last edited by …"), for active staff only. profiles itself needs users.view.
create or replace function public.staff_names(p_ids uuid[])
returns table (id uuid, full_name text) language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name
    from public.profiles p
   where p.id = any (p_ids[1:200])
     and exists (select 1 from public.profiles me where me.id = (select auth.uid()) and me.status = 'active')
$$;
revoke all on function public.staff_names(uuid[]) from public, anon;
grant execute on function public.staff_names(uuid[]) to authenticated;

-- The note from "Send back" (approval workflow, P4-A), shown to the author until they resubmit.
-- Read from the append-only audit log, so there is no second copy to keep in step.
create or replace function public.latest_review_note(p_entity_type text, p_entity_id uuid)
returns table (note text, author text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.metadata ->> 'note', x.actor_label, x.occurred_at
    from (select l.action, l.metadata, l.actor_label, l.occurred_at
            from public.activity_logs l
           where l.entity_type = p_entity_type and l.entity_id = p_entity_id::text
             and l.action in (p_entity_type || '.send_back', p_entity_type || '.submit')
           order by l.occurred_at desc, l.id desc
           limit 1) x
   where x.action = p_entity_type || '.send_back' and public.has_permission(p_entity_type || '.view')
$$;
revoke all on function public.latest_review_note(text, uuid) from public, anon;
grant execute on function public.latest_review_note(text, uuid) to authenticated;
