import type { SectionProps } from '../../types';
import { Container } from '../../shared/ui/container';
import { Picture } from '../../shared/ui/picture';
import { RichText } from '../../shared/ui/rich-text';
import { ArrowLink, SectionFrame } from '../../shared/ui/section';

/**
 * Editorial opening: a large heading beside the text, then one wide photograph that settles as it
 * scrolls into view (the page's one moment, `.ma-develop` in tokens.css).
 */
export function ModernIntroduction({ id, data }: SectionProps<'introduction'>) {
  return (
    <SectionFrame id={id}>
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <h2
            id={`${id}-title`}
            className="tpl-h2 text-[clamp(2rem,1.3rem+2.8vw,3.5rem)] lg:col-span-5"
          >
            {data.heading}
          </h2>
          <div className="lg:col-span-7 lg:pt-2">
            <RichText className="tpl-lede text-tpl-ink-muted">{data.body}</RichText>
            {data.cta ? (
              <ArrowLink href={data.cta.href} label={data.cta.label} className="mt-8" />
            ) : null}
          </div>
        </div>
        {data.image ? (
          <div className="ma-develop relative mt-14 aspect-[4/3] overflow-hidden rounded-tpl-lg sm:mt-20 sm:aspect-[16/9] lg:aspect-[21/9]">
            <Picture
              image={data.image}
              sizes="(min-width: 1152px) 1152px, 100vw"
              fill
              className="object-cover"
            />
          </div>
        ) : null}
      </Container>
    </SectionFrame>
  );
}
