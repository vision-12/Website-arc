#!/usr/bin/env node
/**
 * Invites the first Super Administrator of a new installation (spec §7.2 step 12).
 * The invite email contains a one-time link; no password is ever sent (MP §3.5).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… NEXT_PUBLIC_SITE_URL=… \
 *     node scripts/bootstrap-super-admin.mjs --email head@school.example --name "Full Name"
 */
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SECRET_KEY: key,
  NEXT_PUBLIC_SITE_URL: site,
} = process.env;
if (!values.email || !values.name || !url || !key?.startsWith('sb_secret_') || !site) {
  console.error(
    'Usage: --email <address> --name "<full name>" with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SITE_URL set.',
  );
  process.exit(2);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { count } = await admin
  .from('user_roles')
  .select('role_id, roles!inner(key)', { count: 'exact', head: true })
  .eq('roles.key', 'super_admin');
if ((count ?? 0) > 0) {
  console.error(
    'This installation already has a Super Administrator. Invite further users from the admin area.',
  );
  process.exit(1);
}

const { data, error } = await admin.auth.admin.inviteUserByEmail(values.email, {
  data: { full_name: values.name },
  redirectTo: new URL('/accept-invite', site).toString(),
});
if (error) {
  console.error(`Invite failed: ${error.message}`);
  process.exit(1);
}
const { data: role } = await admin.from('roles').select('id').eq('key', 'super_admin').single();
const { error: roleError } = await admin
  .from('user_roles')
  .insert({ user_id: data.user.id, role_id: role.id });
if (roleError) {
  console.error(`Role assignment failed: ${roleError.message}`);
  process.exit(1);
}
await admin.from('activity_logs').insert({
  source: 'cron',
  action: 'users.bootstrap_super_admin',
  entity_type: 'profile',
  entity_id: data.user.id,
  summary: 'Invited the first Super Administrator',
});
console.log(`Invitation sent to ${values.email}. They must accept it and set up two-step sign-in.`);
