import { getSiteSettings } from '@/features/cms/settings/queries';
import { buildThemeVars, themeVarsToCss } from '@/features/templates/theme/build-theme-vars';

/**
 * School theme as a same-origin stylesheet (spec §6.2, ADR-000 "CSP and static shells").
 * Linked from the root layout as /theme.css?v=<settings version>, so each version is immutable;
 * a settings save bumps the version and the 'site-settings' tag re-renders the layout's link.
 */
export async function GET(request: Request) {
  const { settings, version } = await getSiteSettings();
  const requested = new URL(request.url).searchParams.get('v');
  const immutable = requested === String(version);
  return new Response(themeVarsToCss(buildThemeVars(settings.theme)), {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate',
    },
  });
}
