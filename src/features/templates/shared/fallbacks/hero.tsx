import { t } from '@/lib/i18n/t';
import type { HeroSlide, SectionProps } from '../../types';
import { HeroCarousel } from '../islands/hero-carousel';
import { ButtonLink } from '../ui/button-link';
import { Container } from '../ui/container';
import { EnterText } from '../ui/enter-text';
import { Picture } from '../ui/picture';

export function heroLabels() {
  return {
    region: t('site.heroRegion'),
    slide: t('site.slide'),
    pause: t('site.pauseSlides'),
    play: t('site.playSlides'),
    previous: t('site.previousSlide'),
    next: t('site.nextSlide'),
    goTo: t('site.goToSlide'),
  };
}

/**
 * Shared hero: the photograph fills the first screen; the words sit on a solid panel, never on a
 * busy image. The first slide's image is preloaded; the others load lazily.
 */
export function FallbackHero({ data, schoolNameAsH1 }: SectionProps<'hero'>) {
  const slides = data.slides.map((slide, i) => (
    <HeroSlideView
      key={i}
      slide={slide}
      first={i === 0}
      {...(i === 0 && schoolNameAsH1 ? { schoolName: schoolNameAsH1 } : {})}
    />
  ));
  return (
    <section aria-label={t('site.heroRegion')} className="relative bg-tpl-band text-tpl-band-ink">
      {slides.length > 1 ? (
        <HeroCarousel
          autoplaySeconds={data.autoplaySeconds}
          labels={heroLabels()}
          controlsClassName="absolute bottom-6 right-4 sm:right-6 lg:right-8"
        >
          {slides}
        </HeroCarousel>
      ) : (
        slides
      )}
    </section>
  );
}

function HeroSlideView({
  slide,
  first,
  schoolName,
}: {
  slide: HeroSlide;
  first: boolean;
  schoolName?: string;
}) {
  return (
    <div className="relative min-h-[calc(100svh-var(--tpl-header-h,4.5rem))]">
      <Picture image={slide.image} sizes="100vw" priority={first} fill className="object-cover" />
      <Container className="relative flex min-h-[calc(100svh-var(--tpl-header-h,4.5rem))] items-end pt-32 pb-24 sm:pb-20">
        <div className="max-w-2xl rounded-tpl bg-tpl-band/95 p-6 sm:p-10">
          {schoolName ? <h1 className="tpl-label mb-4 text-tpl-band-muted">{schoolName}</h1> : null}
          <p className="tpl-display">
            {first ? <EnterText text={slide.heading} /> : slide.heading}
          </p>
          {slide.subheading ? (
            <p className={`tpl-lede mt-5 text-tpl-band-muted ${first ? 'tpl-enter-fade' : ''}`}>
              {slide.subheading}
            </p>
          ) : null}
          {slide.cta ? (
            <div className={`mt-8 ${first ? 'tpl-enter-fade [--tpl-step:1]' : ''}`}>
              <ButtonLink link={slide.cta} variant="primaryOnBand" />
            </div>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
