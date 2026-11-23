import { t } from '@/lib/i18n/t';

export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only z-[100] rounded-md bg-card px-4 py-3 font-medium text-foreground shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      {t('common.skipToContent')}
    </a>
  );
}
