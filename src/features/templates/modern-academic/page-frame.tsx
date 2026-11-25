import { cn } from '@/lib/utils';
import type { PageFrameProps } from '../types';
import { Breadcrumbs } from '../shared/ui/breadcrumbs';
import { Container } from '../shared/ui/container';

/** Inner pages: a large left-aligned title with plenty of air, then the content. */
export function ModernPageFrame({ layout, title, breadcrumbs, sidebar, children }: PageFrameProps) {
  return (
    <>
      <Container className="pt-14 pb-10 sm:pt-20 sm:pb-14">
        <Breadcrumbs items={breadcrumbs} />
        <h1 className="tpl-display mt-6 max-w-4xl text-[clamp(2.5rem,1.5rem+3.5vw,4.5rem)]">
          {title}
        </h1>
      </Container>
      <Container size={layout === 'wide' ? 'wide' : 'default'} className="pb-20 sm:pb-28">
        {layout === 'with_sidebar' && sidebar ? (
          <div className="grid gap-12 border-t border-tpl-rule pt-12 lg:grid-cols-[1fr_16rem] lg:gap-20">
            <div className="min-w-0">{children}</div>
            <aside className="lg:sticky lg:top-24 lg:self-start">{sidebar}</aside>
          </div>
        ) : (
          <div
            className={cn('border-t border-tpl-rule pt-12', layout === 'default' && 'max-w-3xl')}
          >
            {children}
          </div>
        )}
      </Container>
    </>
  );
}
