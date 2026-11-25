import { cn } from '@/lib/utils';
import type { SectionProps } from '../../types';
import { Container } from '../../shared/ui/container';
import { Icon } from '../../shared/ui/icon';
import { SectionFrame, SectionHeading } from '../../shared/ui/section';
import { SmartLink } from '../../shared/ui/smart-link';

/** A ruled facts strip directly under the hero: values in the heading face, labels beneath. */
export function InstitutionalQuickInfo({ id, data }: SectionProps<'quickInfo'>) {
  return (
    <SectionFrame
      id={id}
      {...(data.heading ? {} : { label: data.items.map((i) => i.label).join(', ') })}
      className="border-b border-tpl-rule bg-tpl-surface py-0 sm:py-0"
    >
      <Container>
        {data.heading ? <SectionHeading id={id} title={data.heading} className="pt-14" /> : null}
        <dl
          className={cn(
            'grid grid-cols-2 divide-tpl-rule md:divide-x',
            data.items.length >= 3 && 'md:grid-cols-3',
            data.items.length >= 4 && 'lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none',
          )}
        >
          {data.items.map((item, i) => (
            <div
              key={item.label}
              className={cn(
                'flex flex-col-reverse gap-1.5 py-7 pr-4 md:px-6 md:first:pl-0',
                i % 2 === 1 && 'pl-4 md:pl-6',
                'border-tpl-rule max-md:[&:nth-child(n+3)]:border-t',
              )}
            >
              <dt className="tpl-small flex items-center gap-2 text-tpl-ink-muted">
                <Icon name={item.icon} className="size-4 text-tpl-brand-text" />
                {item.label}
              </dt>
              <dd className="font-tpl-heading text-xl font-semibold sm:text-2xl">
                {item.href ? (
                  <SmartLink href={item.href} className="tpl-link">
                    {item.value}
                  </SmartLink>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </SectionFrame>
  );
}
