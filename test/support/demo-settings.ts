import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SiteSettings } from '@/features/cms/settings/schema';

/** The local demo school's settings, straight from the seed SQL (unit tests only). */
export function seededSettingsJson(): unknown {
  const sql = readFileSync(join(process.cwd(), 'supabase/seed/demo-content.sql'), 'utf8');
  const match = /update public\.site_settings set data = '([\s\S]*)'::jsonb where id = 1;/.exec(
    sql,
  );
  if (!match?.[1]) throw new Error('demo settings update not found');
  return JSON.parse(match[1].replaceAll("''", "'"));
}

export function seededSettings(): SiteSettings {
  return SiteSettings.parse(seededSettingsJson());
}
