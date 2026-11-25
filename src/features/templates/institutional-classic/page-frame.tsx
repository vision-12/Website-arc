import { cn } from '@/lib/utils';
import type { PageFrameProps } from '../types';
import { Breadcrumbs } from '../shared/ui/breadcrumbs';
import { Container } from '../shared/ui/container';

/** Inner pages: a ruled title block, then the content in a reading column or beside a sidebar. */
export function InstitutionalPageFrame({
  layout,
  title,
  breadcrumbs,
  sidebar,
  children,
}: PageFrameProps) {
  return (
    <>
      <div className="border-b border-tpl-rule bg-tpl-surface">
        <Container className="py-10 sm:py-14">
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="tpl-display mt-5 max-w-4xl text-[clamp(2rem,1.5rem+2.2vw,3.25rem)]">
            {title}
          </h1>
        </Container>
      </div>
      <Container size={layout === 'wide' ? 'wide' : 'default'} className="py-12 sm:py-16">
        {layout === 'with_sidebar' && sidebar ? (
          <div className="grid gap-12 lg:grid-cols-[15rem_1fr] lg:gap-16">
            <aside className="border-t-2 border-tpl-brand pt-5 lg:sticky lg:top-24 lg:self-start">
              {sidebar}
            </aside>
            <div className="min-w-0">{children}</div>
          </div>
        ) : (
          <div className={cn(layout === 'default' && 'max-w-3xl')}>{children}</div>
        )}
      </Container>
    </>
  );
}
