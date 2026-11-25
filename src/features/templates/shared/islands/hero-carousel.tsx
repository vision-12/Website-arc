'use client';
import { Children, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useHydrated } from '@/hooks/use-hydrated';
import { fill } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

export interface HeroCarouselLabels {
  region: string;
  slide: string;
  pause: string;
  play: string;
  previous: string;
  next: string;
  goTo: string;
}

/**
 * Rotates server-rendered slides (the template designs each slide; this only changes which one
 * shows). WCAG 2.2.2: autoplay has a visible pause control, pauses while the pointer or keyboard
 * focus is inside, and never runs under prefers-reduced-motion.
 *
 * The controls are one capsule: pause, previous, next and the dots. The active dot fills while
 * its slide shows, so visitors can see that the slides move and when the next one comes. That
 * fill is also the timer: the slide changes when its animation ends, so pausing (the button,
 * hovering, focus) freezes the fill and the countdown together and they can never drift apart.
 *
 * Smoothness: slides cross-fade on opacity and the fill grows with a transform, both on the
 * compositor. Slides not yet needed stay display:none, so their lazy images don't download while
 * the first image (the page's largest paint) is still arriving on a slow connection; each is
 * primed two seconds after the previous change.
 */
export function HeroCarousel({
  autoplaySeconds,
  labels,
  tone = 'onImage',
  className,
  controlsClassName,
  children,
}: {
  autoplaySeconds: number | null;
  labels: HeroCarouselLabels;
  /** onImage: dark glass over a photograph. onSurface: a solid capsule on the page colour. */
  tone?: 'onImage' | 'onSurface';
  className?: string;
  /** Positions the controls (the capsule sits inside, aligned by this element's flex rules). */
  controlsClassName?: string;
  children: ReactNode;
}) {
  const slides = Children.toArray(children);
  const total = slides.length;
  const hydrated = useHydrated();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [primed, setPrimed] = useState<ReadonlySet<number>>(() => new Set([0]));
  const prime = (i: number) =>
    setPrimed((current) => (current.has(i) ? current : new Set(current).add(i)));

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const autoplay = total > 1 && autoplaySeconds !== null && !reduced;
  const rotating = autoplay && playing && !held;

  // Prime the next slide two seconds after each change: early enough for its image to arrive
  // before the cross-fade, late enough not to compete with the first paint.
  useEffect(() => {
    if (total < 2) return;
    const timer = window.setTimeout(() => prime((index + 1) % total), 2000);
    return () => window.clearTimeout(timer);
  }, [index, total]);

  const go = (next: number) => {
    const target = (next + total) % total;
    prime(target);
    setIndex(target);
  };

  const onImage = tone === 'onImage';
  const control = cn(
    'tpl-btn inline-flex size-10 items-center justify-center rounded-full',
    onImage ? 'hover:bg-white/15' : 'hover:bg-tpl-surface-alt',
  );
  const fillStyle = {
    '--tpl-dur': `${autoplaySeconds ?? 0}s`,
    animationPlayState: rotating ? 'running' : 'paused',
  } as CSSProperties;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.region}
      className={cn('relative', className)}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
      }}
    >
      <div className="grid" aria-live={rotating ? 'off' : 'polite'}>
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={fill(labels.slide, { n: i + 1, total })}
            aria-hidden={i !== index}
            inert={i !== index}
            hidden={!primed.has(i) && i !== index}
            className={cn(
              'transition-opacity duration-[600ms] ease-[var(--tpl-ease)] motion-reduce:duration-150 starting:opacity-0',
              // Every slide shares one grid cell: the carousel is as tall as its tallest slide.
              'col-start-1 row-start-1',
              i === index ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            {slide}
          </div>
        ))}
      </div>

      {hydrated && total > 1 ? (
        <div className={cn('pointer-events-none flex', controlsClassName)}>
          <div
            className={cn(
              'pointer-events-auto inline-flex items-center gap-0.5 rounded-full p-1',
              onImage
                ? 'tpl-glass tpl-glass-dark'
                : 'bg-tpl-surface text-tpl-ink shadow-[0_1px_2px_rgb(16_24_40/0.06)] ring-1 ring-tpl-rule',
            )}
          >
            {autoplay ? (
              <button
                type="button"
                className={control}
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? labels.pause : labels.play}
              >
                {playing ? (
                  <Pause aria-hidden="true" className="size-4" />
                ) : (
                  <Play aria-hidden="true" className="size-4" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              className={control}
              onClick={() => go(index - 1)}
              aria-label={labels.previous}
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <div className="flex items-center px-1">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={fill(labels.goTo, { n: i + 1 })}
                  aria-current={i === index ? 'true' : undefined}
                  className="group inline-flex h-10 w-6 items-center justify-center"
                >
                  <span
                    className={cn(
                      // Never animate width (layout): the dot stretches with a transform.
                      'relative block h-1.5 w-5 overflow-hidden rounded-full transition-[transform,background-color] duration-200',
                      i === index ? 'scale-x-100' : 'scale-x-[0.3]',
                      onImage
                        ? i === index && autoplay
                          ? 'bg-white/35'
                          : i === index
                            ? 'bg-white'
                            : 'bg-white/55 group-hover:bg-white/80'
                        : i === index && autoplay
                          ? 'bg-tpl-rule-strong'
                          : i === index
                            ? 'bg-tpl-ink'
                            : 'bg-tpl-rule-strong group-hover:bg-tpl-ink-muted',
                    )}
                  >
                    {i === index && autoplay ? (
                      <span
                        key={index}
                        aria-hidden="true"
                        style={fillStyle}
                        onAnimationEnd={() => go(index + 1)}
                        className={cn(
                          'absolute inset-0 origin-left animate-[tpl-fill_var(--tpl-dur)_linear_forwards] rounded-full',
                          onImage ? 'bg-white' : 'bg-tpl-ink',
                        )}
                      />
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={control}
              onClick={() => go(index + 1)}
              aria-label={labels.next}
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
