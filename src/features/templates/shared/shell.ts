import 'server-only';
import type { SiteSettings } from '@/features/cms/settings/schema';
import type { ImageRef, ResolvedNavItem, ShellData } from '../types';
import { pageIdsOf, resolveLink } from './links';
import { getImageRefs } from './loaders/media';
import { getPagePaths } from './loaders/pages';

/** Everything a template's header and footer need, with links and the logo resolved. */
export async function resolveShell(settings: SiteSettings, year: number): Promise<ShellData> {
  const targets = [
    ...settings.navigation.flatMap((item) => [item, ...item.children]),
    ...settings.footer.columns.flatMap((column) => column.links),
  ];
  const logoId = settings.identity.logoMediaId;
  const [pagePaths, images] = await Promise.all([
    getPagePaths(pageIdsOf(targets)),
    getImageRefs(logoId ? [logoId] : []),
  ]);
  return buildShell(settings, year, pagePaths, images);
}

/** Pure part of resolveShell: hidden items and links to unpublished pages are left out. */
export function buildShell(
  settings: SiteSettings,
  year: number,
  pagePaths: Record<string, string>,
  images: Record<string, ImageRef>,
): ShellData {
  const navigation: ResolvedNavItem[] = [];
  for (const item of settings.navigation) {
    if (!item.visible) continue;
    const children = item.children.flatMap((child) => {
      const link = child.visible ? resolveLink(child, pagePaths) : null;
      return link ? [{ ...link, id: child.id }] : [];
    });
    const link = resolveLink(item, pagePaths);
    if (!link && children.length === 0) continue;
    navigation.push({
      id: item.id,
      label: item.label,
      href: link?.href ?? null,
      external: link?.external ?? false,
      children,
    });
  }

  const columns = settings.footer.columns
    .map((column) => ({
      heading: column.heading,
      links: column.links.flatMap((l) => {
        const link = l.visible ? resolveLink(l, pagePaths) : null;
        return link ? [link] : [];
      }),
    }))
    .filter((column) => column.links.length > 0);

  const logoId = settings.identity.logoMediaId;
  return {
    identity: { ...settings.identity, logo: (logoId && images[logoId]) || null },
    navigation,
    footer: {
      ...(settings.footer.blurb ? { blurb: settings.footer.blurb } : {}),
      columns,
      copyrightName: settings.footer.copyrightName ?? settings.identity.name,
    },
    contact: settings.contact,
    social: settings.social,
    attribution: settings.attribution,
    admissionsEnabled: settings.admissions.enabled,
    year,
  };
}
