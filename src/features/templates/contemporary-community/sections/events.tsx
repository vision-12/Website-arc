import { t } from '@/lib/i18n/t';
import type { SectionProps } from '../../types';
import { dateParts, formatTime } from '../../shared/format';
import { Container } from '../../shared/ui/container';
import { SectionFrame, SectionHeading } from '../../shared/ui/section';
import { SmartLink } from '../../shared/ui/smart-link';

/** Events first: rounded cards that lead with a big day number. */
export function CommunityEvents({ id, data, locale }: SectionProps<'upcomingEvents'>) {
  if (data.events.length === 0) return null;
  return (
    <SectionFrame id={id}>
      <Container>
        <SectionHeading
          id={id}
          title={data.heading}
          action={{ label: t('site.seeAllEvents'), href: data.viewAllHref }}
        />
        <ul className="grid gap-4 md:grid-cols-3">
          {data.events.map((event) => {
            const parts = dateParts(event.startsAt, locale);
            return (
              <li key={event.href}>
                <SmartLink
                  href={event.href}
                  className="tpl-card flex h-full flex-col rounded-tpl-lg border border-tpl-rule bg-tpl-surface p-6"
                >
                  <p className="flex items-baseline gap-2">
                    <span className="font-tpl-heading text-5xl leading-none font-bold tracking-[-0.03em] text-tpl-brand-text">
                      {parts.day}
                    </span>
                    <span className="font-semibold">{parts.month}</span>
                    <span className="text-tpl-ink-muted">{parts.weekday}</span>
                  </p>
                  <h3 className="tpl-h3 mt-6">
                    <span className="tpl-link">{event.title}</span>
                  </h3>
                  <p className="tpl-small mt-auto pt-4 text-tpl-ink-muted">
                    <time dateTime={event.startsAt}>
                      {event.allDay ? t('site.allDay') : formatTime(event.startsAt, locale)}
                    </time>
                    {event.venue ? <> · {event.venue}</> : null}
                  </p>
                </SmartLink>
              </li>
            );
          })}
        </ul>
      </Container>
    </SectionFrame>
  );
}
