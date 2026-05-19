import type { HTMLAttributes } from 'react';

type SkeletonVariant = 'line' | 'card' | 'circle';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  rounded?: string;
}

const variantStyles: Record<SkeletonVariant, string> = {
  line:   'h-4 w-full rounded',
  card:   'h-24 w-full rounded-xl',
  circle: 'h-10 w-10 rounded-full',
};

export function Skeleton({
  variant = 'line',
  width,
  height,
  rounded,
  className = '',
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className={`bg-slate-700 animate-pulse ${variantStyles[variant]} ${width ?? ''} ${height ?? ''} ${rounded ?? ''} ${className}`.trim()}
      {...props}
    />
  );
}
