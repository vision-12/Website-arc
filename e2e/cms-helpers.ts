import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Browser, Page } from '@playwright/test';
import sharp from 'sharp';
import { adminClient } from '../test/support/supabase';
import { uniqueIp } from './auth-helpers';

export const unique = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

/** A real JPEG for upload tests (a 1600 × 1000 photo, so the device resize has work to do). */
export function photo(width = 1600, height = 1000): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 40, g: 110, b: 170 } } })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/** A page created directly in the database (as the system), for tests that start mid-story. */
export async function seedPage(opts: {
  title: string;
  slug: string;
  text?: string;
  status?: 'draft' | 'published';
  body?: unknown;
}) {
  const { data, error } = await adminClient()
    .from('pages')
    .insert({
      title: opts.title,
      slug: opts.slug,
      status: opts.status ?? 'published',
      ...(opts.status === 'draft'
        ? {}
        : { publish_at: new Date(Date.now() - 60_000).toISOString() }),
      body: (opts.body ?? {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: opts.text ?? 'Hello' }] }],
      }) as never,
    })
    .select('id, path, version')
    .single();
  if (error) throw error;
  return data;
}

/** What Vercel Schedules does every 5 minutes (plan P4-I). */
export async function runPublishCron(request: APIRequestContext) {
  const res = await request.get('/api/cron/publish', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  if (!res.ok()) throw new Error(`cron failed: ${res.status()}`);
  return (await res.json()) as { published: number };
}

/** A visitor with no session, in their own browser context. */
export async function visitor(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await uniqueIp(page);
  return page;
}

/** The next whole minute at least 70 s away, as the date and time fields expect (Kampala time). */
export function nextMinuteInKampala(): { date: string; time: string; at: Date } {
  const at = new Date(Math.ceil((Date.now() + 70_000) / 60_000) * 60_000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
    at,
  };
}

/** Toasts are announced twice by Radix (visible text and a screen-reader copy): check the first. */
export function toast(page: Page, text: string | RegExp) {
  return page.getByText(text).first();
}

export async function openEditor(page: Page, id: string) {
  await page.goto(`/admin/pages/${id}`);
  await page.getByLabel('Page title').waitFor();
  // The editor mounts after hydration (Tiptap immediatelyRender: false).
  await page.getByRole('textbox', { name: 'Page text' }).waitFor();
}
