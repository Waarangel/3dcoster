import type { HTMLAttributes } from 'react';

type SkeletonVariant = 'line' | 'card' | 'circle';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  rounded?: string;
}

// Per-variant defaults split into h/w/rounded so each consumer-supplied
// override can replace its corresponding default rather than ride alongside
// it in the DOM. See WR-01 in 09-REVIEW.md: previously variantStyles baked
// `h-4 w-full rounded` (etc.) into a single string and the consumer
// overrides were merely appended, leaving two competing classes in
// className and relying on Tailwind/CSS source order to pick a winner.
const variantDefaults: Record<SkeletonVariant, { h: string; w: string; rounded: string }> = {
  line:   { h: 'h-4',  w: 'w-full', rounded: 'rounded' },
  card:   { h: 'h-24', w: 'w-full', rounded: 'rounded-xl' },
  circle: { h: 'h-10', w: 'w-10',   rounded: 'rounded-full' },
};

export function Skeleton({
  variant = 'line',
  width,
  height,
  rounded,
  className = '',
  ...props
}: SkeletonProps) {
  const v = variantDefaults[variant];
  const cls = [
    'bg-slate-700 animate-pulse',
    height ?? v.h,
    width ?? v.w,
    rounded ?? v.rounded,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className={cls}
      {...props}
    />
  );
}
