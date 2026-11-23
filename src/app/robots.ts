import type { MetadataRoute } from 'next';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { publicEnv } from '@/lib/env/public';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { settings } = await getSiteSettings();
  if (!settings.seo.indexable) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/preview', '/api'] },
    sitemap: new URL('/sitemap.xml', publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
  };
}
