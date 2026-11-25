import { cn } from '@/lib/utils';
import type { PageFrameProps } from '../types';
import { Breadcrumbs } from '../shared/ui/breadcrumbs';
import { Container } from '../shared/ui/container';

/** Inner pages: the title in a warm rounded card, then the content. */
export function CommunityPageFrame({
  layout,
  title,
  breadcrumbs,
  sidebar,
  children,
}: PageFrameProps) {
  return (
    <>
      <Container className="pt-6 sm:pt-10">
        <div className="rounded-tpl-lg bg-tpl-surface-alt px-6 py-10 sm:px-12 sm:py-14">
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="tpl-display mt-5 max-w-4xl text-[clamp(2.25rem,1.5rem+3vw,4rem)]">
            {title}
          </h1>
        </div>
      </Container>
      <Container size={layout === 'wide' ? 'wide' : 'default'} className="py-12 sm:py-16">
        {layout === 'with_sidebar' && sidebar ? (
          <div className="grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-14">
            <aside className="rounded-tpl-lg bg-tpl-surface p-5 ring-1 ring-tpl-rule lg:sticky lg:top-24 lg:self-start">
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
