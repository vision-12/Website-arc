import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CacheTags } from '@/lib/cache/tags';
import { createPublicClient } from '@/lib/supabase/server';
import { FALLBACK_SETTINGS, FALLBACK_VERSION } from './fallback';
import { SiteSettings } from './schema';

export interface SettingsSnapshot {
  settings: SiteSettings;
  /** `site_settings.version` — used to cache-bust /theme.css. */
  version: number;
  /** False on a fresh install (no row yet) or if the stored row fails validation. */
  configured: boolean;
}

/**
 * The single read path for school configuration (MP §3.2). Cached by tag; every settings save
 * calls updateTag('site-settings'). Reads through the cookie-less public client (spec D7).
 */
export async function getSiteSettings(): Promise<SettingsSnapshot> {
  'use cache';
  cacheTag(CacheTags.siteSettings);
  cacheLife('hours');

  const fallback: SettingsSnapshot = {
    settings: SiteSettings.parse(FALLBACK_SETTINGS),
    version: FALLBACK_VERSION,
    configured: false,
  };
  try {
    const { data, error } = await createPublicClient()
      .from('site_settings')
      .select('data, version')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return fallback;
    const parsed = SiteSettings.safeParse(data.data);
    if (!parsed.success) {
      // Never take the whole site down for a bad settings row; the admin settings screen reports it.
      console.error(
        'site_settings failed validation',
        parsed.error.issues.map((i) => i.path.join('.')),
      );
      return fallback;
    }
    return { settings: parsed.data, version: data.version, configured: true };
  } catch {
    return fallback;
  }
}
