-- LOCAL DEVELOPMENT ONLY (applied by `supabase db reset`). Never used for a school's production project;
-- provisioning uses supabase/seed/production.sql. Passwords here are public test values.

-- Vault secrets used by the database (production values are generated at provisioning, spec §7.2 step 6).
select vault.create_secret('local-form-signing-secret-0123456789abcdef', 'form_signing_secret');
select vault.create_secret('local-ip-hash-salt-0123456789abcdef', 'ip_hash_salt');
select vault.create_secret('local-reference-feistel-key-0123456789', 'ref_feistel_key');

-- Neutral demo settings (no school identity).
insert into public.site_settings (id, version, data) values (1, 1, '{
  "identity": {"name": "Demo School", "shortName": "Demo", "logoMediaId": null, "faviconMediaId": null, "schoolType": "secondary", "curricula": ["UNEB"]},
  "theme": {"template": "institutional-classic", "primary": "#1f2937", "secondary": "#4b5563", "fontHeading": "source-serif-4", "fontBody": "inter", "radius": "md", "density": "comfortable"},
  "navigation": [], "homepage": [], "footer": {"columns": []},
  "contact": {"phones": [], "emails": [], "address": "", "hours": [], "geo": null, "mapZoom": 15, "enquirySubjects": ["General enquiry", "Admissions"], "phoneRequired": false},
  "social": [],
  "admissions": {"enabled": false, "referencePrefix": "DEM", "maxFileSizeMb": 10, "maxFiles": 10, "acknowledgementMessage": "", "closedMessage": "", "pendingAlertDays": 7, "infoRequestLinkDays": 7},
  "seo": {"defaultTitleTemplate": "%s | Demo School", "defaultDescription": "", "ogImageMediaId": null, "indexable": false},
  "locale": {"timezone": "Africa/Kampala", "dateFormat": "d MMM yyyy"},
  "features": {"admissionsTracking": false, "contentApproval": false, "mfaRequiredForAdmins": false},
  "attribution": {"showAltrastateCredit": true},
  "content": {"maxFeaturedNews": 3, "allowOfficeDocs": false},
  "legal": {"privacyPageId": null, "termsPageId": null, "consentTextVersion": "dev"}
}'::jsonb);
insert into public.site_settings_private (id, data) values (1, '{"retention": {"unsuccessfulApplicationsMonths": null, "enquiriesMonths": null, "activityLogMonths": 24, "emailLogMonths": 12, "trashDays": 30}}');

-- One confirmed, active account per role. Password for all: Local-dev-password-1
do $$
declare
  r record;
  v_id uuid;
begin
  for r in select * from (values
    ('super_admin', 'super.admin@demo.test', 'Sam Super'),
    ('school_admin', 'school.admin@demo.test', 'Aisha Admin'),
    ('headteacher', 'headteacher@demo.test', 'Hellen Head'),
    ('admissions_officer', 'admissions@demo.test', 'Okello Admissions'),
    ('content_editor', 'editor@demo.test', 'Esther Editor'),
    ('events_manager', 'events@demo.test', 'Moses Events'),
    ('read_only_staff', 'readonly@demo.test', 'Ruth Reader'),
    ('platform_support', 'support@altrastate.test', 'Pat Support')
  ) as t(role_key, email, full_name) loop
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', r.email,
            extensions.crypt('Local-dev-password-1', extensions.gen_salt('bf')), now(), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', r.full_name), now(), now(),
            '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true),
            'email', now(), now(), now());
    update public.profiles set status = 'active' where id = v_id;
    insert into public.user_roles (user_id, role_id) select v_id, id from public.roles where key = r.role_key;
  end loop;
end $$;
