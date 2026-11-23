import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CacheTags } from '@/lib/cache/tags';
import { FALLBACK_SETTINGS, FALLBACK_VERSION } from './fallback';
import { SiteSettings } from './schema';

export interface SettingsSnapshot {
  settings: SiteSettings;
  /** `site_settings.version` — used to cache-bust /theme.css. */
  version: number;
}

/**
 * The single read path for school configuration (MP §3.2).
 * Phase 1: no database yet, so this returns the neutral fallback. Phase 2 replaces the body with a
 * read of the `site_settings` row through the cookie-less public client; the signature stays.
 */
export async function getSiteSettings(): Promise<SettingsSnapshot> {
  'use cache';
  cacheTag(CacheTags.siteSettings);
  cacheLife('hours');
  return Promise.resolve({
    settings: SiteSettings.parse(FALLBACK_SETTINGS),
    version: FALLBACK_VERSION,
  });
}
