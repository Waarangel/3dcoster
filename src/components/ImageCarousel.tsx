import { useState, useEffect, useCallback, useRef } from 'react';

import screenshot1 from '../assets/screenshots/image1.png';
import screenshot2 from '../assets/screenshots/image2.png';
import screenshot3 from '../assets/screenshots/image3.png';
import screenshot4 from '../assets/screenshots/image4.png';
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, []);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, []);

  useEffect(() => {
    if (isHovered) {
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
  }, [isHovered, goNext]);

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
      <button
        onClick={goPrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center
                   bg-slate-900/70 hover:bg-slate-900/90 text-white rounded-full
                   transition-all backdrop-blur-sm border border-slate-700/50
                   opacity-0 group-hover:opacity-100 cursor-pointer"
        aria-label="Previous screenshot"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Right arrow */}
      <button
        onClick={goNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center
                   bg-slate-900/70 hover:bg-slate-900/90 text-white rounded-full
                   transition-all backdrop-blur-sm border border-slate-700/50
                   opacity-0 group-hover:opacity-100 cursor-pointer"
        aria-label="Next screenshot"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
              index === currentIndex
                ? 'bg-blue-400 w-6'
                : 'bg-slate-600 hover:bg-slate-500 w-2.5'
            }`}
            aria-label={`Go to screenshot ${index + 1}`}
            aria-current={index === currentIndex ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
