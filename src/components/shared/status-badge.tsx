import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/i18n/t';

export type ContentStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';

const VARIANT = {
  draft: 'neutral',
  in_review: 'warning',
  scheduled: 'outline',
  published: 'success',
  archived: 'neutral',
} as const;

/** Plain-language lifecycle label (MP §11): "On website", not "published". */
export function StatusBadge({ status }: { status: ContentStatus }) {
  return <Badge variant={VARIANT[status]}>{t(`status.${status}`)}</Badge>;
}
