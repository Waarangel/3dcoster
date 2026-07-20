import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

interface RevealProps {
  children: ReactNode;
  /** Seconds of delay before this element reveals (use for stagger). */
  delay?: number;
  /** Distance in px the element rises from. */
  y?: number;
  className?: string;
  /**
   * `mount` fires once on load (above-the-fold hero choreography);
   * `inView` fires once when scrolled into view (below-the-fold sections).
   */
  trigger?: 'mount' | 'inView';
}

/**
 * Single reveal primitive for the brand surfaces. Honors reduced-motion by
 * rendering the final state with no transform motion. Below-the-fold use is
 * `whileInView` with `{ once: true }` so content is shown — never permanently
 * hidden — even if the observer fires late.
 *
 * Examples:
 *   <Reveal trigger="mount" delay={0.07}>{hero}</Reveal>
 *   <Reveal trigger="inView" delay={0.05 * i}>{card}</Reveal>
 */
export function Reveal({ children, delay = 0, y = 18, className, trigger = 'inView' }: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const hidden = { opacity: 0, y };
  const shown = { opacity: 1, y: 0 };
  const transition = { duration: 0.6, ease: EASE_OUT_EXPO, delay };

  if (trigger === 'mount') {
    return (
      <motion.div className={className} initial={hidden} animate={shown} transition={transition}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={hidden}
      whileInView={shown}
      viewport={{ once: true, amount: 0.2 }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
