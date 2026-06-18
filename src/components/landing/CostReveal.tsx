import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
  useReducedMotion,
} from 'motion/react';

interface CostLine {
  label: string;
  amount: number;
  counted?: boolean;
}

/** Realistic fully-loaded cost of one medium print (120 g PLA, ~8 h). The story:
 *  most sellers price off filament alone and quietly lose money on the rest.
 *  NOTE: illustrative example figures — see the card's "Example print" framing. */
const COST_LINES: CostLine[] = [
  { label: 'Filament', amount: 3.2, counted: true },
  { label: 'Your time', amount: 4.2 },
  { label: 'Printer wear', amount: 1.5 },
  { label: 'Marketplace fees', amount: 1.05 },
  { label: 'Failed prints', amount: 0.6 },
  { label: 'Packaging', amount: 0.55 },
  { label: 'Nozzle wear', amount: 0.4 },
  { label: 'Electricity', amount: 0.3 },
];

const LEN = COST_LINES.length;
const TRUE_COST = COST_LINES.reduce((sum, l) => sum + l.amount, 0); // 11.80
const GUESS = COST_LINES[0].amount; // 3.20
const HIDDEN = TRUE_COST - GUESS; // 8.60
const PROFIT_PRICE = 19.5;

const cumulativeTo = (step: number) =>
  COST_LINES.slice(0, step).reduce((sum, l) => sum + l.amount, 0);

function segmentColor(line: CostLine, index: number): string {
  if (line.counted) return 'var(--brand)';
  return `rgba(91, 179, 255, ${(0.7 - index * 0.07).toFixed(2)})`;
}

export function CostReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduceMotion = useReducedMotion();

  // `step` = how many cost lines have landed. Filament (step 1) is shown up
  // front — "where you'd price" — then the hidden costs accumulate onto it.
  const [step, setStep] = useState(reduceMotion ? LEN : 1);

  const total = useMotionValue(reduceMotion ? TRUE_COST : GUESS);
  const smoothTotal = useSpring(total, { stiffness: 130, damping: 22 });
  const display = useTransform(smoothTotal, (v) => `$${v.toFixed(2)}`);

  // Advance the accumulation. A longer beat before the first hidden cost
  // ("you'd stop at $3.20… but") then a steady tick through the rest.
  useEffect(() => {
    if (reduceMotion || !inView || step >= LEN) return;
    const delay = step === 1 ? 600 : 185;
    const timer = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(timer);
  }, [step, inView, reduceMotion]);

  useEffect(() => {
    total.set(reduceMotion ? TRUE_COST : cumulativeTo(step));
  }, [step, reduceMotion, total]);

  const complete = step >= LEN;
  const EASE_CSS = 'cubic-bezier(0.16,1,0.3,1)';

  return (
    <div
      ref={ref}
      className="group/card relative rounded-2xl border p-6 sm:p-7"
      style={{
        background: 'var(--surface)',
        borderColor: 'rgba(23,150,255,0.18)',
        boxShadow: '0 0 90px -24px var(--brand-glow), 0 24px 60px -36px rgba(0,0,0,0.7)',
      }}
    >
      <div className="flex items-center gap-2 text-xs text-[var(--ink-faint)]">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand)' }} />
        Example print · 120 g · 8 h
      </div>

      {/* Before → after: guess then truth. Grid keeps the labels on one line and
          the two numbers on a shared baseline so nothing drifts. */}
      <div className="mt-4 grid grid-cols-[auto_auto_1fr] items-baseline gap-x-3 sm:gap-x-4 gap-y-1.5">
        <div className="text-xs text-[var(--ink-faint)]">You'd guess</div>
        <div aria-hidden="true" />
        <div className="text-xs text-[var(--ink-faint)]">True cost to make</div>

        <div className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink-soft)] tabular-nums leading-none">
          ${GUESS.toFixed(2)}
        </div>
        <svg className="w-5 h-5 text-[var(--ink-faint)] self-center shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <motion.div className="font-display text-4xl sm:text-5xl font-extrabold text-[var(--ink)] tabular-nums leading-none">
          {display}
        </motion.div>
      </div>

      {/* Payoff line — the gap you're not counting, revealed once the tally lands */}
      <div
        className="mt-2 text-sm font-medium text-[var(--brand-soft)] transition-opacity duration-500"
        style={{ opacity: complete ? 1 : 0 }}
      >
        ${HIDDEN.toFixed(2)} you weren't counting
      </div>

      {/* Layered cost bar — grows in lock-step with the breakdown below */}
      <div className="mt-5 flex h-3.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
        {COST_LINES.map((line, i) => (
          <div
            key={line.label}
            style={{
              width: `${(line.amount / TRUE_COST) * 100}%`,
              background: segmentColor(line, i),
              transformOrigin: 'left',
              transform: i < step ? 'scaleX(1)' : 'scaleX(0)',
              transition: `transform 0.5s ${EASE_CSS}`,
              borderRight: i < LEN - 1 ? '1.5px solid var(--surface)' : undefined,
            }}
          />
        ))}
      </div>

      {/* Breakdown — all rows reserve space (stable height); fade in as they land */}
      <ul className="mt-6 space-y-2.5">
        {COST_LINES.map((line, i) => {
          const revealed = i < step;
          return (
            <li
              key={line.label}
              className="flex items-center gap-3 text-sm"
              style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? 'translateX(0)' : 'translateX(-6px)',
                transition: `opacity 0.4s ${EASE_CSS}, transform 0.4s ${EASE_CSS}`,
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: line.counted ? 'var(--brand)' : 'rgba(91,179,255,0.4)' }}
              />
              <span className="text-[var(--ink-soft)]">{line.label}</span>
              {line.counted && (
                <span className="text-[10px] uppercase tracking-wide text-[var(--brand-soft)] border border-[rgba(23,150,255,0.3)] rounded px-1.5 py-0.5">
                  you counted this
                </span>
              )}
              <span className="ml-auto tabular-nums text-[var(--ink)]">${line.amount.toFixed(2)}</span>
            </li>
          );
        })}
      </ul>

      {/* Profit price */}
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-[rgba(23,150,255,0.25)] bg-[rgba(23,150,255,0.08)] px-4 py-3.5">
        <svg className="w-5 h-5 text-[var(--brand-soft)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <span className="text-sm text-[var(--ink-soft)]">Price that profits</span>
        <span className="ml-auto font-display text-xl font-bold text-[var(--brand-soft)] tabular-nums">
          ${PROFIT_PRICE.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
