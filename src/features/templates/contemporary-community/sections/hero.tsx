import { t } from '@/lib/i18n/t';
import type { HeroSlide, SectionProps } from '../../types';
import { heroLabels } from '../../shared/fallbacks/hero';
import { HeroCarousel } from '../../shared/islands/hero-carousel';
import { ButtonLink } from '../../shared/ui/button-link';
import { Container } from '../../shared/ui/container';
import { EnterText } from '../../shared/ui/enter-text';
import { Picture } from '../../shared/ui/picture';

/** A rounded warm card with the words beside a rounded photograph; photograph first on phones. */
export function CommunityHero({ data, schoolNameAsH1 }: SectionProps<'hero'>) {
  const slides = data.slides.map((slide, i) => (
    <Slide
      key={i}
      slide={slide}
      first={i === 0}
      {...(i === 0 && schoolNameAsH1 ? { schoolName: schoolNameAsH1 } : {})}
    />
  ));
  return (
    <section aria-label={t('site.heroRegion')} className="bg-tpl-bg">
      {slides.length > 1 ? (
        <HeroCarousel
          autoplaySeconds={data.autoplaySeconds}
          labels={heroLabels()}
          tone="onSurface"
          controlsClassName="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8"
        >
          {slides}
        </HeroCarousel>
      ) : (
        slides
      )}
    </section>
  );
}

function Slide({
  slide,
  first,
  schoolName,
}: {
  slide: HeroSlide;
  first: boolean;
  schoolName?: string;
}) {
  return (
    <Container className="py-4 sm:py-6">
      <div className="grid gap-4 lg:min-h-[calc(100svh-var(--tpl-header-h)-6.5rem)] lg:grid-cols-[1.15fr_1fr] lg:gap-5">
        <div className="relative order-1 aspect-[16/10] overflow-hidden rounded-tpl-lg sm:aspect-[4/3] lg:order-2 lg:aspect-auto">
          <Picture
            image={slide.image}
            sizes="(min-width: 1024px) 46vw, 100vw"
            priority={first}
            fill
            className="object-cover"
          />
        </div>
        <div className="order-2 flex flex-col justify-center rounded-tpl-lg bg-tpl-surface-alt p-6 sm:p-12 lg:order-1">
          {schoolName ? <h1 className="tpl-label text-tpl-brand-text">{schoolName}</h1> : null}
          <p className="tpl-display mt-4 text-[clamp(2rem,1.3rem+2.6vw,3.5rem)]">
            {first ? <EnterText text={slide.heading} /> : slide.heading}
          </p>
          {slide.subheading ? (
            <p className={`tpl-lede mt-5 text-tpl-ink-muted ${first ? 'tpl-enter-fade' : ''}`}>
              {slide.subheading}
            </p>
          ) : null}
          {slide.cta ? (
            <div className={`mt-8 ${first ? 'tpl-enter-fade [--tpl-step:1]' : ''}`}>
              <ButtonLink link={slide.cta} className="rounded-full px-6" />
            </div>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
