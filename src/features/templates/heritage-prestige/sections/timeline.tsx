import type { SectionProps } from '../../types';
import { Container } from '../../shared/ui/container';
import { SectionFrame, SectionHeading } from '../../shared/ui/section';

/**
 * Key numbers as a milestone timeline (P3-F): the same value and label, laid along a line, the
 * way a school with a long history tells it. Vertical on phones, horizontal from large screens.
 * The line draws itself in the school's colour as it scrolls into view (the page's one moment,
 * tokens.css).
 */
export function HeritageTimeline({ id, data }: SectionProps<'statistics'>) {
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
        <ol className="hp-timeline relative grid gap-12 border-l border-tpl-rule-strong pl-8 lg:auto-cols-fr lg:grid-flow-col lg:gap-0 lg:border-t lg:border-l-0 lg:pt-10 lg:pl-0">
          {data.items.map((item) => (
            <li key={item.label} className="relative lg:pr-10">
              <span
                aria-hidden="true"
                className="absolute top-3 -left-[calc(2rem+5px)] block size-2.5 rounded-full bg-tpl-brand ring-4 ring-tpl-surface-alt lg:-top-[calc(2.5rem+5px)] lg:left-0"
              />
              <p className="font-tpl-heading text-[clamp(2.25rem,1.8rem+1.6vw,3.25rem)] leading-none text-tpl-brand-text">
                {item.value}
              </p>
              <p className="mt-3 max-w-[15rem] text-tpl-ink-muted">{item.label}</p>
            </li>
          ))}
        </ol>
      </Container>
    </SectionFrame>
  );
}
