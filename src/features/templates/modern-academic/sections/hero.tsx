import { t } from '@/lib/i18n/t';
import type { HeroSlide, SectionProps } from '../../types';
import { heroLabels } from '../../shared/fallbacks/hero';
import { HeroCarousel } from '../../shared/islands/hero-carousel';
import { ButtonLink } from '../../shared/ui/button-link';
import { Container } from '../../shared/ui/container';
import { EnterText } from '../../shared/ui/enter-text';
import { Picture } from '../../shared/ui/picture';

/**
 * Full-bleed photograph filling the first screen, the headline large in white over a scrim strong
 * enough for AA contrast where the words sit (the bottom of the picture).
 */
export function ModernHero({ data, schoolNameAsH1 }: SectionProps<'hero'>) {
  const slides = data.slides.map((slide, i) => (
    <Slide
      key={i}
      slide={slide}
      first={i === 0}
      {...(i === 0 && schoolNameAsH1 ? { schoolName: schoolNameAsH1 } : {})}
    />
  ));
  return (
    <section aria-label={t('site.heroRegion')} className="relative bg-tpl-band text-white">
      {slides.length > 1 ? (
        <HeroCarousel
          autoplaySeconds={data.autoplaySeconds}
          labels={heroLabels()}
          controlsClassName="absolute inset-x-0 bottom-6 mx-auto max-w-6xl justify-end px-4 sm:bottom-10 sm:px-6 lg:px-8"
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
    <div className="relative grid min-h-[calc(100svh-var(--tpl-header-h))] items-end">
      <Picture image={slide.image} sizes="100vw" priority={first} fill className="object-cover" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.78),rgb(0_0_0/0.35)_50%,rgb(0_0_0/0.05))]"
      />
      <Container className="relative pt-40 pb-24 sm:pb-28">
        {schoolName ? <h1 className="tpl-label text-white/80">{schoolName}</h1> : null}
        <p className="tpl-display mt-4 max-w-4xl text-[clamp(2.5rem,1.1rem+5vw,5.5rem)]">
          {first ? <EnterText text={slide.heading} /> : slide.heading}
        </p>
        {slide.subheading ? (
          <p className={`tpl-lede mt-6 max-w-xl text-white/85 ${first ? 'tpl-enter-fade' : ''}`}>
            {slide.subheading}
          </p>
        ) : null}
        {slide.cta ? (
          <div className={`mt-9 ${first ? 'tpl-enter-fade [--tpl-step:1]' : ''}`}>
            <ButtonLink link={slide.cta} variant="primaryOnBand" />
          </div>
        ) : null}
      </Container>
    </div>
  );
}
