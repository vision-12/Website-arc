import { t } from '@/lib/i18n/t';
import type { HeroSlide, SectionProps } from '../../types';
import { heroLabels } from '../../shared/fallbacks/hero';
import { HeroCarousel } from '../../shared/islands/hero-carousel';
import { ButtonLink } from '../../shared/ui/button-link';
import { Container } from '../../shared/ui/container';
import { EnterText } from '../../shared/ui/enter-text';
import { Picture } from '../../shared/ui/picture';

/** The serif headline beside a photograph in a thin frame, on the parchment ground. */
export function HeritageHero({ data, schoolNameAsH1 }: SectionProps<'hero'>) {
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
          controlsClassName="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:-mt-4 lg:px-8"
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
    <Container className="grid items-center gap-10 py-12 lg:min-h-[calc(100svh-var(--tpl-header-h)-2.5rem-5rem)] lg:grid-cols-12 lg:gap-14 lg:py-16">
      <div className="lg:col-span-6">
        {schoolName ? (
          <h1 className="font-tpl-heading text-lg text-tpl-ink-muted italic">{schoolName}</h1>
        ) : null}
        <span aria-hidden="true" className="mt-5 block h-px w-12 bg-tpl-accent" />
        <p className="tpl-display mt-6 text-[clamp(2.25rem,1.5rem+2.4vw,3.5rem)]">
          {first ? <EnterText text={slide.heading} /> : slide.heading}
        </p>
        {slide.subheading ? (
          <p className={`tpl-lede mt-6 text-tpl-ink-muted ${first ? 'tpl-enter-fade' : ''}`}>
            {slide.subheading}
          </p>
        ) : null}
        {slide.cta ? (
          <div className={`mt-9 ${first ? 'tpl-enter-fade [--tpl-step:1]' : ''}`}>
            <ButtonLink link={slide.cta} />
          </div>
        ) : null}
      </div>
      <div className="lg:col-span-6">
        <div className="border border-tpl-rule-strong p-2.5 sm:p-3">
          <div className="relative aspect-[4/3] lg:aspect-[5/4]">
            <Picture
              image={slide.image}
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority={first}
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </Container>
  );
}
