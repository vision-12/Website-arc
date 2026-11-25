import { cn } from '@/lib/utils';
import type { SectionProps } from '../../types';
import { ButtonLink } from '../ui/button-link';
import { Container } from '../ui/container';
import { Icon } from '../ui/icon';
import { SectionFrame, SectionHeading } from '../ui/section';
import { SmartLink } from '../ui/smart-link';
import { closingLine } from './modules';

/** Quick facts as a ruled strip: label above, value below; the icon is a quiet marker. */
export function FallbackQuickInfo({ id, data }: SectionProps<'quickInfo'>) {
  return (
    <SectionFrame
      id={id}
      {...(data.heading ? {} : { label: data.items.map((i) => i.label).join(', ') })}
      className="py-12 sm:py-14"
    >
      <Container>
        {data.heading ? <SectionHeading id={id} title={data.heading} /> : null}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-tpl-lg border border-tpl-rule bg-tpl-rule md:grid-cols-3 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none">
          {data.items.map((item) => {
            const value = item.href ? (
              <SmartLink href={item.href} className="tpl-link">
                {item.value}
              </SmartLink>
            ) : (
              item.value
            );
            return (
              <div key={item.label} className="flex flex-col gap-2 bg-tpl-surface p-5 sm:p-6">
                <dt className="tpl-small flex items-center gap-2 text-tpl-ink-muted">
                  <Icon name={item.icon} className="size-4 text-tpl-brand-text" />
                  {item.label}
                </dt>
                <dd className="text-lg font-semibold">{value}</dd>
              </div>
            );
          })}
        </dl>
      </Container>
    </SectionFrame>
  );
}

/** Key numbers set large: a type moment, figures given by the school. */
export function FallbackStatistics({ id, data }: SectionProps<'statistics'>) {
  return (
    <SectionFrame
      id={id}
      tone="band"
      {...(data.heading
        ? {}
        : { label: data.items.map((i) => `${i.value} ${i.label}`).join(', ') })}
    >
      <Container>
        {data.heading ? <SectionHeading id={id} title={data.heading} tone="band" /> : null}
        <dl
          className={cn(
            'grid gap-x-10 gap-y-12 sm:grid-cols-2',
            data.items.length >= 3 && 'lg:grid-cols-3',
            data.items.length === 4 && 'xl:grid-cols-4',
          )}
        >
          {data.items.map((item) => (
            <div
              key={item.label}
              className="flex flex-col-reverse border-t border-tpl-band-ink/25 pt-6"
            >
              <dt className="mt-3 text-tpl-band-muted">{item.label}</dt>
              <dd className="font-tpl-heading text-5xl leading-none font-semibold tracking-tight sm:text-6xl">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </SectionFrame>
  );
}

/** One clear next step for families, with the intake's closing date when one is open. */
export function FallbackAdmissionsCta({ id, data, locale }: SectionProps<'admissionsCta'>) {
  const closing = closingLine(data.openIntake, locale);
  return (
    <SectionFrame id={id} tone="alt">
      <Container size="narrow" className="text-center">
        <h2 id={`${id}-title`} className="tpl-h2">
          {data.heading}
        </h2>
        <p className="tpl-lede mx-auto mt-5 max-w-xl text-tpl-ink-muted">{data.body}</p>
        {closing ? <p className="tpl-label mt-6 text-tpl-brand-text">{closing}</p> : null}
        <ButtonLink link={data.cta} className="mt-8" />
      </Container>
    </SectionFrame>
  );
}
