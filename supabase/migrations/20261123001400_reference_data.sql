-- Reference data every installation needs (spec §2.1, §2.2, §2.5; PRD §5.1, §7). Changed only by migration.

-- ── Permissions (69) ─────────────────────────────────────────────────────────
insert into public.permissions (key, module, action, description, is_sensitive)
select m || '.' || a, m, a,
  case a
    when 'view' then 'See ' || label || ' in the admin area'
    when 'create' then 'Add new ' || label
    when 'edit' then 'Edit ' || label
    when 'publish' then 'Publish ' || label || ' to the website, schedule or hide it'
    when 'approve' then 'Approve ' || label || ' submitted for review'
    when 'delete' then 'Move ' || label || ' to Trash and restore it'
  end,
  false
from (values ('pages', 'website pages'), ('news', 'news and announcements'), ('academics', 'academic information'),
             ('events', 'events'), ('gallery', 'gallery albums'), ('staff', 'staff profiles'),
             ('resources', 'downloadable resources')) as mods(m, label)
cross join unnest(array['view', 'create', 'edit', 'publish', 'approve', 'delete']) as a;

insert into public.permissions (key, module, action, description, is_sensitive) values
  ('media.view', 'media', 'view', 'See the media library', false),
  ('media.create', 'media', 'create', 'Upload photos and files to the media library', false),
  ('media.edit', 'media', 'edit', 'Edit photo descriptions and replace files', false),
  ('media.delete', 'media', 'delete', 'Remove unused media', false),
  ('enquiries.view', 'enquiries', 'view', 'Read contact enquiries (contains personal details)', true),
  ('enquiries.edit', 'enquiries', 'edit', 'Mark enquiries as read or replied, assign them and add notes', true),
  ('enquiries.delete', 'enquiries', 'delete', 'Move enquiries to Trash', true),
  ('enquiries.export', 'enquiries', 'export', 'Download enquiries as a spreadsheet', true),
  ('admissions.view', 'admissions', 'view', 'Read applications and their documents (children''s personal data)', true),
  ('admissions.create', 'admissions', 'create', 'Enter paper applications', true),
  ('admissions.edit', 'admissions', 'edit', 'Change application statuses, assign applications and request information', true),
  ('admissions.manage', 'admissions', 'manage', 'Set up intakes, application forms and statuses', false),
  ('admissions.export', 'admissions', 'export', 'Download applications as a spreadsheet', true),
  ('admissions.delete', 'admissions', 'delete', 'Erase an applicant''s personal data', true),
  ('admissions.view_notes', 'admissions', 'view_notes', 'Read and write internal notes on applications', true),
  ('admissions.view_medical', 'admissions', 'view_medical', 'Read applicants'' medical information (special personal data)', true),
  ('appearance.view', 'appearance', 'view', 'See the website appearance settings', false),
  ('appearance.manage', 'appearance', 'manage', 'Change the template, colours, logo, homepage and menus', false),
  ('settings.view', 'settings', 'view', 'See school settings', false),
  ('settings.manage', 'settings', 'manage', 'Change school settings', false),
  ('users.view', 'users', 'view', 'See staff accounts (names and email addresses)', true),
  ('users.manage', 'users', 'manage', 'Invite staff, change their roles and deactivate accounts', false),
  ('users.manage_roles', 'users', 'manage_roles', 'Create custom roles and grant support access', false),
  ('activity.view', 'activity', 'view', 'See the activity log', false),
  ('activity.export', 'activity', 'export', 'Download the activity log', true),
  ('trash.purge', 'trash', 'purge', 'Permanently delete items from Trash', false);

-- ── Roles (PRD §7 + Altrastate support) ──────────────────────────────────────
insert into public.roles (key, name, description, is_system, requires_mfa) values
  ('super_admin', 'Super Administrator', 'Full administration of this school''s installation.', true, true),
  ('school_admin', 'School Administrator', 'General website and content management.', true, false),
  ('headteacher', 'Headteacher / Director', 'Oversight: approves publications, reviews admissions and reports, manages administrators.', true, false),
  ('admissions_officer', 'Admissions Officer', 'Processes applications and enquiries.', true, true),
  ('content_editor', 'Content Editor', 'News, pages, resources, gallery and media.', true, false),
  ('events_manager', 'Events Manager', 'The events calendar.', true, false),
  ('read_only_staff', 'Read-only Staff', 'Can view website content in the admin area, but not change it.', true, false),
  ('platform_support', 'Altrastate Support', 'Altrastate technical staff. No access to personal data without a time-limited grant.', true, false);

-- ── Role → permission matrix (spec §2.5) ─────────────────────────────────────
create temporary table _grants (role_key text, permission_key text) on commit drop;
-- Super Administrator: everything
insert into _grants select 'super_admin', key from public.permissions;
-- School Administrator: everything except the super-admin-only keys
insert into _grants select 'school_admin', key from public.permissions
  where key not in ('admissions.delete', 'admissions.view_medical', 'users.manage_roles', 'activity.export', 'trash.purge');
-- Headteacher: view + approve + publish all content; admissions oversight; manage administrators
insert into _grants select 'headteacher', m || '.' || a
  from unnest(array['pages', 'news', 'academics', 'events', 'gallery', 'staff', 'resources']) m,
       unnest(array['view', 'approve', 'publish']) a;
insert into _grants select 'headteacher', unnest(array['media.view', 'enquiries.view', 'admissions.view', 'admissions.view_notes',
  'appearance.view', 'users.view', 'users.manage', 'activity.view']);
-- Admissions Officer
insert into _grants select 'admissions_officer', unnest(array['media.view', 'enquiries.view', 'enquiries.edit',
  'admissions.view', 'admissions.create', 'admissions.edit', 'admissions.manage', 'admissions.export', 'admissions.view_notes']);
-- Content Editor: pages, news, resources, gallery (+ view everything content), media
insert into _grants select 'content_editor', m || '.view'
  from unnest(array['pages', 'news', 'academics', 'events', 'gallery', 'staff', 'resources']) m;
insert into _grants select 'content_editor', m || '.' || a
  from unnest(array['pages', 'news', 'resources', 'gallery']) m, unnest(array['create', 'edit', 'publish', 'delete']) a;
insert into _grants select 'content_editor', unnest(array['media.view', 'media.create', 'media.edit', 'media.delete', 'appearance.view']);
-- Events Manager
insert into _grants select 'events_manager', m || '.view'
  from unnest(array['pages', 'news', 'academics', 'events', 'gallery', 'staff', 'resources']) m;
insert into _grants select 'events_manager', 'events.' || a from unnest(array['create', 'edit', 'publish', 'delete']) a;
insert into _grants select 'events_manager', unnest(array['media.view', 'media.create', 'media.edit']);
-- Read-only Staff
insert into _grants select 'read_only_staff', m || '.view'
  from unnest(array['pages', 'news', 'academics', 'events', 'gallery', 'staff', 'resources']) m;
insert into _grants select 'read_only_staff', unnest(array['media.view', 'appearance.view']);
-- Altrastate Support: technical only; personal data only through support_access_grants
insert into _grants select 'platform_support', m || '.view'
  from unnest(array['pages', 'news', 'academics', 'events', 'gallery', 'staff', 'resources']) m;
insert into _grants select 'platform_support', unnest(array['media.view', 'appearance.view', 'appearance.manage',
  'settings.view', 'settings.manage', 'activity.view']);

insert into public.role_permissions (role_id, permission_key)
select distinct r.id, g.permission_key from _grants g join public.roles r on r.key = g.role_key;

-- ── Admission statuses (PRD §5.1) ────────────────────────────────────────────
insert into public.admission_statuses (key, name, public_label, colour, sort_order, is_initial, is_terminal, outcome, notify_applicant, email_template_key) values
  ('submitted', 'Submitted', 'Received', '#475569', 10, true, false, 'pending', true, 'application.acknowledgement'),
  ('under_review', 'Under Review', 'Being reviewed', '#1d4ed8', 20, false, false, 'pending', true, 'application.status.under_review'),
  ('info_required', 'Additional Information Required', 'More information needed', '#b45309', 30, false, false, 'pending', true, 'application.info_request'),
  ('shortlisted', 'Shortlisted', 'Shortlisted', '#6d28d9', 40, false, false, 'pending', true, 'application.status.shortlisted'),
  ('accepted', 'Accepted', 'Offered a place', '#15803d', 50, false, true, 'accepted', true, 'application.status.accepted'),
  ('rejected', 'Rejected', 'Not successful', '#b91c1c', 60, false, true, 'rejected', true, 'application.status.rejected'),
  ('withdrawn', 'Withdrawn', 'Withdrawn', '#64748b', 70, false, true, 'withdrawn', false, null);
