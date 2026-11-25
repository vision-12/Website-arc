import 'server-only';
import type { SiteSettings } from '@/features/cms/settings/schema';
import { serverEnv } from '@/lib/env/server';
import { verifyPreviewToken, type PreviewPayload, type PreviewTokenError } from './preview-token';

/** Checks a preview link's token for the signed-in user and the template in the URL. */
export function readPreviewToken(
  token: string | undefined,
  expected: { userId: string; template: string },
): { ok: true; payload: PreviewPayload } | { ok: false; error: PreviewTokenError } {
  if (!token) return { ok: false, error: 'malformed' };
  return verifyPreviewToken(token, serverEnv().PREVIEW_TOKEN_SECRET, expected);
}

/** The saved settings with the preview's template and unsaved changes applied, in memory only. */
export function applyPreview<T extends SiteSettings>(settings: T, payload: PreviewPayload): T {
  return {
    ...settings,
    theme: { ...settings.theme, ...payload.o?.theme, template: payload.k },
    homepage: payload.o?.homepage ?? settings.homepage,
  };
}
