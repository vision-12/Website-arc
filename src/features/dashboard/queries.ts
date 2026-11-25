import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { z } from '@/lib/zod';
import type { DashboardCounts } from './tiles';

const Counts = z.object({
  pagesInReview: z.number(),
  pagesScheduledSoon: z.number(),
  pagesStaleDrafts: z.number(),
  mediaMissingAlt: z.number(),
  trashPages: z.number(),
  trashMedia: z.number(),
});

/** Counts for the tiles, as the signed-in person may see them (the RPC is security invoker). */
export async function getDashboardCounts(): Promise<DashboardCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_dashboard_counts');
  if (error) throw error;
  return Counts.parse(data);
}

export interface ActivityItem {
  id: number;
  who: string;
  summary: string;
  at: string;
}

/**
 * Recent changes to website content for the overview (needs activity.view). Only content entries
 * (pages, media): their summaries are plain sentences with no personal data.
 */
export async function getRecentContentActivity(limit = 8): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, actor_label, summary, occurred_at, source')
    .in('entity_type', ['pages', 'media'])
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    who: r.source === 'cron' ? 'The scheduler' : (r.actor_label ?? 'Someone'),
    summary: r.summary ?? '',
    at: r.occurred_at,
  }));
}
