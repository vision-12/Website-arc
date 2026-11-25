import type { SectionProps } from '../../types';
import { ArrowLink, SectionFrame } from '../../shared/ui/section';
import { Container } from '../../shared/ui/container';
import { Picture } from '../../shared/ui/picture';
import { RichText } from '../../shared/ui/rich-text';

/** Prominent leadership: a framed portrait and the head teacher's words in a large serif italic. */
export function HeritageLeadership({ id, data }: SectionProps<'leadershipMessage'>) {
  const { person } = data;
  return (
    <SectionFrame id={id}>
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {person.image ? (
            <div className="lg:col-span-5">
              <div className="border border-tpl-rule-strong p-2.5 sm:p-3">
                <div className="relative aspect-[4/5]">
                  <Picture
                    image={person.image}
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          ) : null}
          <div className={person.image ? 'lg:col-span-7' : 'mx-auto max-w-3xl lg:col-span-12'}>
            <h2 id={`${id}-title`} className="tpl-h2">
              {data.heading}
            </h2>
            <RichText className="mt-8 font-tpl-heading text-[clamp(1.25rem,1.1rem+0.6vw,1.625rem)] leading-relaxed italic">
              {data.message}
            </RichText>
            <p className="mt-10 text-lg font-semibold">{person.name}</p>
            <p className="text-tpl-ink-muted">{person.role}</p>
            {data.cta ? (
              <ArrowLink href={data.cta.href} label={data.cta.label} className="mt-6" />
            ) : null}
          </div>
        </div>
      </Container>
    </SectionFrame>
  );
}
