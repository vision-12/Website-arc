import { cn } from '@/lib/utils';
import type { SectionProps } from '../../types';
import { Container } from '../../shared/ui/container';
import { SectionFrame, SectionHeading } from '../../shared/ui/section';

/** Key numbers as a type moment: oversized, tightly tracked numerals in the brand colour. */
export function ModernStatistics({ id, data }: SectionProps<'statistics'>) {
  return (
    <SectionFrame
      id={id}
      tone="alt"
      {...(data.heading
        ? {}
        : { label: data.items.map((i) => `${i.value} ${i.label}`).join(', ') })}
    >
      <Container>
        {data.heading ? <SectionHeading id={id} title={data.heading} /> : null}
        <dl
          className={cn(
            'grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-12 sm:gap-y-14',
            data.items.length >= 4 && 'lg:grid-cols-4',
            data.items.length === 3 && 'lg:grid-cols-3',
          )}
        >
          {data.items.map((item) => (
            <div key={item.label} className="flex flex-col-reverse">
              <dt className="mt-4 max-w-[16rem] text-tpl-ink-muted">{item.label}</dt>
              <dd className="font-tpl-heading text-[clamp(2.75rem,2rem+3.4vw,5.5rem)] leading-none font-semibold tracking-[-0.05em] text-tpl-brand-text">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </SectionFrame>
  );
}
