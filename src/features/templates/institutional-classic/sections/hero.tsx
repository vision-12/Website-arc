import { t } from '@/lib/i18n/t';
import type { HeroSlide, SectionProps } from '../../types';
import { heroLabels } from '../../shared/fallbacks/hero';
import { HeroCarousel } from '../../shared/islands/hero-carousel';
import { ButtonLink } from '../../shared/ui/button-link';
import { Container } from '../../shared/ui/container';
import { EnterText } from '../../shared/ui/enter-text';
import { Picture } from '../../shared/ui/picture';

/**
 * The photograph fills the rest of the first screen; the words sit on a solid brand panel
 * anchored to its lower left, marked by a rule in the accent colour. On phones the panel follows
 * the photograph.
 */
export function InstitutionalHero({ data, schoolNameAsH1 }: SectionProps<'hero'>) {
  const slides = data.slides.map((slide, i) => (
    <Slide
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
          controlsClassName="absolute inset-x-0 top-4 mx-auto max-w-6xl justify-end px-4 sm:top-6 sm:px-6 lg:top-auto lg:bottom-8 lg:px-8"
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
    <div className="relative grid lg:min-h-[calc(100svh-13.25rem)] lg:items-end">
      <div className="relative aspect-[4/3] sm:aspect-[16/9] lg:absolute lg:inset-0 lg:aspect-auto">
        <Picture image={slide.image} sizes="100vw" priority={first} fill className="object-cover" />
      </div>
      {/* In flow, not absolute: a long headline makes the hero taller instead of covering the header. */}
      <div className="relative lg:pt-28">
        <Container>
          <div className="border-t-4 border-tpl-accent bg-tpl-band py-9 sm:py-11 lg:max-w-2xl lg:px-10">
            {schoolName ? <h1 className="tpl-label text-tpl-band-muted">{schoolName}</h1> : null}
            <p className="tpl-display mt-3 text-[clamp(1.875rem,1.4rem+1.7vw,3rem)]">
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
    </div>
  );
}
