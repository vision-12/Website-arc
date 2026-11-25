import { fill } from '@/lib/i18n/format';
import { t } from '@/lib/i18n/t';
import { cn } from '@/lib/utils';
import type { SectionProps } from '../../types';
import { dateParts, formatDate, formatTime } from '../format';
import { Container } from '../ui/container';
import { Picture } from '../ui/picture';
import { SectionFrame, SectionHeading } from '../ui/section';
import { SmartLink } from '../ui/smart-link';

/** One lead story large, the rest as a compact list: an editorial page, not a wall of equal cards. */
export function FallbackLatestNews({ id, data, locale }: SectionProps<'latestNews'>) {
  const [lead, ...rest] = data.articles;
  if (!lead) return null;
  return (
    <SectionFrame id={id}>
      <Container>
        <SectionHeading
          id={id}
          title={data.heading}
          action={{ label: t('site.seeAllNews'), href: data.viewAllHref }}
        />
        <div className="grid gap-10 lg:grid-cols-[7fr_5fr] lg:gap-14">
          <SmartLink href={lead.href} className="tpl-card group block rounded-tpl-lg">
            {lead.image ? (
              <div className="tpl-zoom relative mb-6 aspect-[16/10] rounded-tpl-lg">
                <Picture
                  image={lead.image}
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  fill
                  className="object-cover"
                />
              </div>
            ) : null}
            <p className="tpl-label text-tpl-ink-muted">
              <time dateTime={lead.publishedAt}>{formatDate(lead.publishedAt, locale)}</time>
              {lead.category ? <> · {lead.category}</> : null}
            </p>
            <h3 className="tpl-h3 mt-2 text-2xl sm:text-3xl">
              <span className="tpl-link">{lead.title}</span>
            </h3>
            {lead.excerpt ? <p className="mt-3 text-tpl-ink-muted">{lead.excerpt}</p> : null}
          </SmartLink>
          <ul className="divide-y divide-tpl-rule border-y border-tpl-rule">
            {rest.map((article) => (
              <li key={article.href}>
                <SmartLink href={article.href} className="group flex gap-5 py-5">
                  {article.image ? (
                    <div className="tpl-zoom relative aspect-square w-24 shrink-0 rounded-tpl sm:w-28">
                      <Picture image={article.image} sizes="112px" fill className="object-cover" />
                    </div>
                  ) : null}
                  <div>
                    <p className="tpl-small text-tpl-ink-muted">
                      <time dateTime={article.publishedAt}>
                        {formatDate(article.publishedAt, locale)}
                      </time>
                    </p>
                    <h3 className="tpl-h3 mt-1">
                      <span className="tpl-link">{article.title}</span>
                    </h3>
                  </div>
                </SmartLink>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </SectionFrame>
  );
}

/** Dates lead: a calendar block per event, then what, when and where. */
export function FallbackUpcomingEvents({ id, data, locale }: SectionProps<'upcomingEvents'>) {
  if (data.events.length === 0) return null;
  return (
    <SectionFrame id={id} tone="alt">
      <Container>
        <SectionHeading
          id={id}
          title={data.heading}
          action={{ label: t('site.seeAllEvents'), href: data.viewAllHref }}
        />
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.events.map((event) => {
            const parts = dateParts(event.startsAt, locale);
            return (
              <li key={event.href}>
                <SmartLink
                  href={event.href}
                  className="tpl-card flex h-full gap-5 rounded-tpl-lg border border-tpl-rule bg-tpl-surface p-5"
                >
                  <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-tpl bg-tpl-brand py-3 text-tpl-brand-ink">
                    <span className="tpl-small">{parts.month}</span>
                    <span className="font-tpl-heading text-3xl leading-none font-semibold">
                      {parts.day}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="tpl-h3">
                      <span className="tpl-link">{event.title}</span>
                    </h3>
                    <p className="tpl-small mt-2 text-tpl-ink-muted">
                      <time dateTime={event.startsAt}>
                        {parts.weekday},{' '}
                        {event.allDay
                          ? t('site.allDay').toLowerCase()
                          : formatTime(event.startsAt, locale)}
                      </time>
                      {event.venue ? <> · {event.venue}</> : null}
                    </p>
                  </div>
                </SmartLink>
              </li>
            );
          })}
        </ul>
      </Container>
    </SectionFrame>
  );
}

/** School levels as photographs that lead to each level's page. */
export function FallbackAcademicOverview({ id, data }: SectionProps<'academicOverview'>) {
  if (data.levels.length === 0) return null;
  return (
    <SectionFrame id={id}>
      <Container>
        <SectionHeading
          id={id}
          title={data.heading}
          action={{ label: t('site.seeAcademics'), href: data.viewAllHref }}
        />
        {data.intro ? (
          <p className="tpl-lede -mt-4 mb-10 max-w-2xl text-tpl-ink-muted">{data.intro}</p>
        ) : null}
        <ul
          className={cn('grid gap-6 sm:grid-cols-2', data.levels.length >= 3 && 'lg:grid-cols-3')}
        >
          {data.levels.map((level) => (
            <li key={level.href}>
              <SmartLink
                href={level.href}
                className="tpl-card group block h-full rounded-tpl-lg border border-tpl-rule bg-tpl-surface"
              >
                {level.image ? (
                  <div className="tpl-zoom relative aspect-[3/2] rounded-t-tpl-lg">
                    <Picture
                      image={level.image}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="p-6">
                  <h3 className="tpl-h3">
                    <span className="tpl-link">{level.name}</span>
                  </h3>
                  {level.summary ? (
                    <p className="mt-2 text-tpl-ink-muted">{level.summary}</p>
                  ) : null}
                </div>
              </SmartLink>
            </li>
          ))}
        </ul>
      </Container>
    </SectionFrame>
  );
}

/** A mosaic of recent photographs; no captions under pictures. */
export function FallbackGalleryPreview({ id, data }: SectionProps<'galleryPreview'>) {
  const images = data.images.slice(0, 5);
  if (images.length === 0) return null;
  return (
    <SectionFrame id={id}>
      <Container>
        <SectionHeading
          id={id}
          title={data.heading}
          action={{ label: t('site.seeGallery'), href: data.viewAllHref }}
        />
        <ul className="grid auto-rows-[10rem] grid-cols-2 gap-3 sm:auto-rows-[12rem] md:grid-cols-4 lg:auto-rows-[14rem]">
          {images.map((image, i) => (
            <li key={image.src} className={cn(i === 0 && 'col-span-2 row-span-2')}>
              <SmartLink
                href={data.viewAllHref}
                className="tpl-zoom relative block size-full rounded-tpl"
              >
                <Picture
                  image={image}
                  sizes={
                    i === 0 ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 25vw, 50vw'
                  }
                  fill
                  className="object-cover"
                />
              </SmartLink>
            </li>
          ))}
        </ul>
      </Container>
    </SectionFrame>
  );
}

export function closingLine(
  intake: { name: string; closesAt: string } | null,
  locale: SectionProps<'admissionsCta'>['locale'],
) {
  return intake
    ? fill(t('site.applicationsClose'), {
        name: intake.name,
        date: formatDate(intake.closesAt, locale),
      })
    : null;
}
