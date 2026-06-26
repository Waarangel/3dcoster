import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui';

import screenshot1 from '../assets/screenshots/image1.png';
import screenshot2 from '../assets/screenshots/image2.png';
import screenshot3 from '../assets/screenshots/image3.png';
import screenshot4 from '../assets/screenshots/image4.png';
// image5.png not in repo — screenshot sequence intentionally skips index 5 (asset retired pre-history-tracked timeframe).
import screenshot6 from '../assets/screenshots/image6.png';
import screenshot7 from '../assets/screenshots/image7.png';

interface CarouselImage {
  src: string;
  alt: string;
}

const images: CarouselImage[] = [
  { src: screenshot1, alt: 'My Printers and Electricity cost configuration' },
  { src: screenshot2, alt: 'Shipping, Packaging Materials, and Marketplace fee settings' },
  { src: screenshot3, alt: 'Asset Library with filament and material table' },
  { src: screenshot4, alt: 'Financial Targets with full cost summary breakdown' },
  { src: screenshot6, alt: 'Print Job Details with G-code file upload' },
  { src: screenshot7, alt: 'Cost Breakdown showing per-unit production costs' },
];

const AUTOPLAY_MS = 5000;
const TRANSITION_MS = 500;

export function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  // H-05 (WCAG 2.2.2): a user-controllable pause. Defaults to playing, but if
  // the user prefers reduced motion we start paused and never auto-advance.
  const [prefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [isPaused, setIsPaused] = useState(prefersReducedMotion);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, []);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, []);

  useEffect(() => {
    // Suspend auto-advance while hovered, explicitly paused, or when the user
    // prefers reduced motion (WCAG 2.2.2 — moving content must be pausable).
    if (isHovered || isPaused || prefersReducedMotion) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(goNext, AUTOPLAY_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, isPaused, prefersReducedMotion, goNext]);

  // The auto-advance can't run under reduced-motion, so don't offer a Play
  // button that would do nothing — the toggle only appears when motion is OK.
  const showPauseToggle = !prefersReducedMotion;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Browser window chrome */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-900 border-b border-slate-700">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="ml-4 text-slate-500 text-sm">3DCoster</span>
        </div>

        {/* Image viewport */}
        <div className="overflow-hidden">
          <div
            className="flex"
            style={{
              transform: `translateX(-${currentIndex * 100}%)`,
              transition: `transform ${TRANSITION_MS}ms ease-in-out`,
            }}
          >
            {images.map((image, index) => (
              <img
                key={index}
                src={image.src}
                alt={image.alt}
                loading={index === 0 ? 'eager' : 'lazy'}
                draggable={false}
                className="w-full flex-shrink-0 block"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Left arrow */}
      <Button
        variant="ghost"
        btnSize="sm"
        onClick={goPrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full backdrop-blur-sm border border-slate-700/50 opacity-0 group-hover:opacity-100 bg-slate-900/70 hover:bg-slate-900/90 text-white"
        aria-label="Previous screenshot"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Button>

      {/* Right arrow */}
      <Button
        variant="ghost"
        btnSize="sm"
        onClick={goNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full backdrop-blur-sm border border-slate-700/50 opacity-0 group-hover:opacity-100 bg-slate-900/70 hover:bg-slate-900/90 text-white"
        aria-label="Next screenshot"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>

      {/* Dot indicators + pause/play toggle (H-05) */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <div className="flex items-center gap-2">
          {images.map((_, index) => (
            // allow-raw-html: dot indicator — dynamic width (w-6/w-2.5) + no children, no Button variant covers it
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                index === currentIndex
                  ? 'bg-blue-400 w-6'
                  : 'bg-slate-600 hover:bg-slate-500 w-2.5'
              }`}
              aria-label={`Go to screenshot ${index + 1}`}
              aria-current={index === currentIndex ? true : undefined}
            />
          ))}
        </div>
        {showPauseToggle && (
          <Button
            variant="ghost"
            btnSize="sm"
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? 'Play screenshot slideshow' : 'Pause screenshot slideshow'}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-white"
          >
            {isPaused ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
