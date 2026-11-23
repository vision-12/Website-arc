-- Shared content lifecycle (spec D2, D3, D12, §2.3): one trigger, one policy template.

-- Public URL of a content row, used for slug-change redirects. NULL = not individually addressable.
create or replace function private.public_path(p_table text, p_row jsonb)
returns text language sql immutable set search_path = '' as $$
  select case p_table
    when 'pages' then p_row ->> 'path'
    when 'news_articles' then '/news/' || (p_row ->> 'slug')
    when 'events' then '/events/' || (p_row ->> 'slug')
    when 'gallery_albums' then '/gallery/' || (p_row ->> 'slug')
    when 'staff_profiles' then '/staff/' || (p_row ->> 'slug')
    when 'resources' then '/resources/' || (p_row ->> 'slug')
    else null
  end
$$;

create or replace function private.write_redirect(p_from text, p_to text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_from = p_to then return; end if;
  delete from public.redirects where from_path = p_to;                 -- renamed back: old target is live again
  update public.redirects set to_path = p_to where to_path = p_from;   -- collapse chains A→B→C into A→C
  insert into public.redirects (from_path, to_path, status_code, source) values (p_from, p_to, 308, 'slug_change')
  on conflict (from_path) do update set to_path = excluded.to_path;
end $$;

create or replace function private.require(p_permission text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_permission(p_permission) then
    raise exception 'TRANSITION_DENIED' using errcode = '42501', detail = format('needs %s', p_permission);
  end if;
end $$;

-- TG_ARGV[0] = permission module (e.g. 'pages', 'news', 'admissions').
-- Admissions intakes use admissions.manage for every transition.
create or replace function private.content_lifecycle_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_module text := tg_argv[0];
  v_end boolean := private.is_end_user();
  v_approval boolean := private.feature_enabled('contentApproval');
  v_edit text := v_module || '.edit';
  v_publish text;
  v_delete text := v_module || '.delete';
  v_ignore text[] := array['version', 'updated_at', 'updated_by', 'deleted_at', 'deleted_by', 'status',
                           'publish_at', 'published_at', 'path', 'search'];
  v_content_changed boolean;
begin
  if v_module = 'admissions' then
    v_edit := 'admissions.manage'; v_delete := 'admissions.manage'; v_publish := 'admissions.manage';
  else
    v_publish := v_module || case when v_approval then '.approve' else '.publish' end;
  end if;

  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    new.updated_by := (select auth.uid());
    if v_end then
      if new.status = 'in_review' and not v_approval then
        raise exception 'TRANSITION_DENIED' using errcode = '42501', detail = 'approval workflow is off';
      elsif new.status not in ('draft', 'in_review') then
        perform private.require(v_publish);
      end if;
      new.deleted_at := null;
    end if;
  else
    new.version := old.version + 1;
    new.updated_at := now();
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := coalesce((select auth.uid()), new.updated_by);

    if v_end then
      if new.deleted_at is distinct from old.deleted_at then
        perform private.require(v_delete);
        new.deleted_by := case when new.deleted_at is null then null else (select auth.uid()) end;
      end if;

      if new.status is distinct from old.status then
        if new.status = 'in_review' then
          if not v_approval then
            raise exception 'TRANSITION_DENIED' using errcode = '42501', detail = 'approval workflow is off';
          end if;
          perform private.require(v_edit);
        elsif old.status = 'in_review' and new.status = 'draft' then
          perform private.require(case when v_module = 'admissions' then v_publish else v_module || '.approve' end);
        else
          perform private.require(v_publish);
        end if;
      end if;

      v_content_changed := (to_jsonb(new) - v_ignore) is distinct from (to_jsonb(old) - v_ignore);
      if v_content_changed then
        -- Changing what the public currently sees is a publish action (spec §2.3).
        perform private.require(case when old.status in ('published', 'scheduled') then v_publish else v_edit end);
      end if;
    end if;

    -- Slug change on something that has been public leaves a permanent redirect (MP §4.2).
    if old.published_at is not null then
      perform private.write_redirect(private.public_path(tg_table_name, to_jsonb(old)),
                                     private.public_path(tg_table_name, to_jsonb(new)));
    end if;
  end if;

  if new.status in ('published', 'scheduled') and new.publish_at is null then
    new.publish_at := now();
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

-- Applies the spec §3.1 LC policy template to a table. Used by this and later migrations.
create or replace function private.apply_lc_policies(p_table regclass, p_module text)
returns void language plpgsql set search_path = '' as $$
declare
  t text := (select relname from pg_class where oid = p_table);
  v_mutate text := format(
    '(select public.has_permission(%1$L)) or (select public.has_permission(%2$L)) or (select public.has_permission(%3$L)) or (select public.has_permission(%4$L))',
    p_module || '.edit', p_module || '.publish', p_module || '.approve', p_module || '.delete');
begin
  execute format('alter table %s enable row level security', p_table);
  execute format($p$create policy %I on %s for select to anon, authenticated
    using ((status = 'published' and publish_at <= now() and deleted_at is null) or (select public.has_permission(%L)))$p$,
    t || '_select', p_table, p_module || '.view');
  execute format('create policy %I on %s for insert to authenticated with check ((select public.has_permission(%L)))',
    t || '_insert', p_table, p_module || '.create');
  execute format('create policy %I on %s for update to authenticated using (%s) with check (%s)',
    t || '_update', p_table, v_mutate, v_mutate);
  execute format($p$create policy %I on %s for delete to authenticated
    using (deleted_at is not null and (select public.has_permission('trash.purge')))$p$, t || '_delete', p_table);
  execute format('create trigger %I before insert or update on %s for each row execute function private.content_lifecycle_guard(%L)',
    t || '_20_lifecycle', p_table, p_module);
end $$;
revoke all on function private.apply_lc_policies(regclass, text) from public, anon, authenticated;
