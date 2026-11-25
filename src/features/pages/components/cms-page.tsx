import { renderRichText } from '@/lib/rich-text/render';
import { t } from '@/lib/i18n/t';
import type { TemplateDefinition } from '@/features/templates/types';
import { Picture } from '@/features/templates/shared/ui/picture';
import { RichText } from '@/features/templates/shared/ui/rich-text';
import { SmartLink } from '@/features/templates/shared/ui/smart-link';
import type { PublicPage } from '../queries';

/**
 * A CMS page in the active template's page frame (MP §3.3, spec §5.1). Templates stay
 * presentation-only: the page arrives as data; the body goes through the static renderer.
 */
export function CmsPage({ page, template }: { page: PublicPage; template: TemplateDefinition }) {
  const { PageFrame } = template;
  const sidebar =
    page.layout === 'with_sidebar' && page.sectionLinks.length > 1 ? (
      <nav aria-label={t('site.inThisSection')}>
        <h2 className="tpl-label text-tpl-ink-muted">{t('site.inThisSection')}</h2>
        <ul className="mt-3 space-y-1">
          {page.sectionLinks.map((link) => (
            <li key={link.href}>
              <SmartLink
                href={link.href}
                className="flex min-h-11 items-center font-medium aria-[current=page]:text-tpl-brand-text"
                {...(link.current ? { 'aria-current': 'page' as const } : {})}
              >
                {link.label}
              </SmartLink>
            </li>
          ))}
        </ul>
      </nav>
    ) : undefined;
  return (
    <PageFrame
      layout={page.layout}
      title={page.title}
      breadcrumbs={page.breadcrumbs}
      {...(sidebar ? { sidebar } : {})}
    >
      {page.cover ? (
        <div className="mb-8 overflow-hidden rounded-tpl">
          <Picture image={page.cover} sizes="(min-width: 1024px) 960px, 100vw" priority />
        </div>
      ) : null}
      <RichText {...(page.layout === 'wide' ? { className: 'max-w-3xl' } : {})}>
        {renderRichText(page.body, page.media)}
      </RichText>
    </PageFrame>
  );
}

/** Shown on every page in draft mode (MP §5 Preview). */
export function PreviewBar({ editorHref }: { editorHref: string }) {
  return (
    <div
      role="region"
      aria-label="Preview"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-neutral-900 px-4 py-2 text-center text-sm text-white"
    >
      <strong className="tracking-wide uppercase">Preview — not published</strong>
      <span>Visitors can’t see these changes yet.</span>
      <a
        href={`/api/draft/disable?next=${encodeURIComponent(editorHref)}`}
        className="font-semibold underline underline-offset-4"
      >
        Exit preview
      </a>
    </div>
  );
}
