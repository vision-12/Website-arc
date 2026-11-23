import { t } from '@/lib/i18n/t';

export default function HomePage() {
  return (
    <section className="space-y-3">
      <h1 className="text-3xl font-semibold text-brand-text">{t('public.placeholderTitle')}</h1>
      <p className="text-muted-foreground">{t('public.placeholderBody')}</p>
    </section>
  );
}
