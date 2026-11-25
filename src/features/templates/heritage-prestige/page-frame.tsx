import { cn } from '@/lib/utils';
import type { PageFrameProps } from '../types';
import { Breadcrumbs } from '../shared/ui/breadcrumbs';
import { Container } from '../shared/ui/container';

/** Inner pages: a centred serif title over a short rule, then a calm reading column. */
export function HeritagePageFrame({
  layout,
  title,
  breadcrumbs,
  sidebar,
  children,
}: PageFrameProps) {
  return (
    <>
      <Container size="narrow" className="pt-14 pb-10 text-center sm:pt-20">
        <Breadcrumbs items={breadcrumbs} className="[&_ol]:justify-center" />
        <h1 className="tpl-display mt-6 text-[clamp(2.25rem,1.5rem+3vw,4rem)]">{title}</h1>
        <span aria-hidden="true" className="mx-auto mt-8 block h-px w-16 bg-tpl-accent" />
      </Container>
      <Container size={layout === 'wide' ? 'wide' : 'default'} className="pb-20 sm:pb-24">
        {layout === 'with_sidebar' && sidebar ? (
          <div className="grid gap-12 lg:grid-cols-[15rem_1fr] lg:gap-16">
            <aside className="border-y border-tpl-rule py-5 lg:sticky lg:top-24 lg:self-start">
              {sidebar}
            </aside>
            <div className="min-w-0">{children}</div>
          </div>
        ) : (
          <div className={cn(layout === 'default' && 'mx-auto max-w-3xl')}>{children}</div>
        )}
      </Container>
    </>
  );
}
