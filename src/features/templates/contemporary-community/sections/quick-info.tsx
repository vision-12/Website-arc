import type { SectionProps } from '../../types';
import { Container } from '../../shared/ui/container';
import { Icon } from '../../shared/ui/icon';
import { SectionFrame, SectionHeading } from '../../shared/ui/section';
import { SmartLink } from '../../shared/ui/smart-link';

/** Quick facts as warm tiles: a round icon badge, the label, then the value (the order a fact is read in). */
export function CommunityQuickInfo({ id, data }: SectionProps<'quickInfo'>) {
  return (
    <SectionFrame
      id={id}
      {...(data.heading ? {} : { label: data.items.map((i) => i.label).join(', ') })}
      className="py-10 sm:py-12"
    >
      <Container>
        {data.heading ? <SectionHeading id={id} title={data.heading} /> : null}
        <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
          {data.items.map((item) => (
            <div key={item.label} className="rounded-tpl-lg bg-tpl-surface-alt p-5 sm:p-6">
              <dt className="text-tpl-ink-muted">
                <span
                  aria-hidden="true"
                  className="mb-4 grid size-11 place-items-center rounded-full bg-tpl-surface text-tpl-brand-text"
                >
                  <Icon name={item.icon} className="size-5" />
                </span>
                {item.label}
              </dt>
              <dd className="mt-1 text-lg leading-snug font-bold">
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
