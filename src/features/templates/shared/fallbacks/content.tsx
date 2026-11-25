import { cn } from '@/lib/utils';
import type { SectionProps } from '../../types';
import { ButtonLink } from '../ui/button-link';
import { Container } from '../ui/container';
import { Picture } from '../ui/picture';
import { RichText } from '../ui/rich-text';
import { SectionFrame, SectionHeading } from '../ui/section';

/** Text and photograph side by side, 50/50; text first on phones. */
export function FallbackIntroduction({ id, data }: SectionProps<'introduction'>) {
  return (
    <SectionFrame id={id}>
      <Container>
        <div className={cn('grid items-center gap-10 lg:gap-16', data.image && 'lg:grid-cols-2')}>
          <div className={cn(!data.image && 'mx-auto max-w-3xl')}>
            <SectionHeading id={id} title={data.heading} className="mb-6 sm:mb-8" />
            <RichText className="tpl-lede text-tpl-ink-muted">{data.body}</RichText>
            {data.cta ? <ButtonLink link={data.cta} variant="secondary" className="mt-8" /> : null}
          </div>
          {data.image ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-tpl-lg sm:aspect-[4/3] lg:aspect-[4/5]">
              <Picture
                image={data.image}
                sizes="(min-width: 1024px) 50vw, 100vw"
                fill
                className="object-cover"
              />
            </div>
          ) : null}
        </div>
      </Container>
    </SectionFrame>
  );
}

export function FallbackCustomRichText({ id, data }: SectionProps<'customRichText'>) {
  return (
    <SectionFrame id={id} named={Boolean(data.heading)}>
      <Container size={data.layout === 'wide' ? 'default' : 'narrow'}>
        {data.heading ? <SectionHeading id={id} title={data.heading} /> : null}
        <RichText className="text-lg">{data.body}</RichText>
      </Container>
    </SectionFrame>
  );
}

/** The head teacher's message: portrait and words side by side; the person is named, not quoted. */
export function FallbackLeadershipMessage({ id, data }: SectionProps<'leadershipMessage'>) {
  const { person } = data;
  return (
    <SectionFrame id={id} tone="alt">
      <Container>
        <div
          className={cn(
            'grid items-center gap-10 lg:gap-16',
            person.image && 'lg:grid-cols-[5fr_7fr]',
          )}
        >
          {person.image ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-tpl-lg">
              <Picture
                image={person.image}
                sizes="(min-width: 1024px) 40vw, 100vw"
                fill
                className="object-cover"
              />
            </div>
          ) : null}
          <div>
            <SectionHeading id={id} title={data.heading} className="mb-6 sm:mb-8" />
            <RichText className="tpl-lede">{data.message}</RichText>
            <p className="mt-8 font-semibold">{person.name}</p>
            <p className="text-tpl-ink-muted">{person.role}</p>
            {data.cta ? <ButtonLink link={data.cta} variant="secondary" className="mt-8" /> : null}
          </div>
        </div>
      </Container>
    </SectionFrame>
  );
}

/** Quotes with the face and name of who said them; no decorative quote glyphs. */
export function FallbackTestimonials({ id, data }: SectionProps<'testimonials'>) {
  return (
    <SectionFrame id={id}>
      <Container>
        <SectionHeading id={id} title={data.heading} />
        <ul
          className={cn(
            'grid gap-6',
            data.items.length > 1 && 'md:grid-cols-2',
            data.items.length > 2 && 'lg:grid-cols-3',
          )}
        >
          {data.items.map((item) => (
            <li
              key={item.name + item.quote.slice(0, 12)}
              className="flex flex-col rounded-tpl-lg border border-tpl-rule bg-tpl-surface p-6 sm:p-8"
            >
              <blockquote className="tpl-lede flex-1">
                <p>{item.quote}</p>
              </blockquote>
              <div className="mt-8 flex items-center gap-4">
                {item.image ? (
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-full">
                    <Picture
                      image={{ ...item.image, alt: '' }}
                      sizes="48px"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <p>
                  <span className="block font-semibold">{item.name}</span>
                  {item.role ? (
                    <span className="tpl-small block text-tpl-ink-muted">{item.role}</span>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </SectionFrame>
  );
}
