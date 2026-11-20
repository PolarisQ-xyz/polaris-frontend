import { cn } from '@/lib/cn';

const SIZES = {
  xs: 'h-4 w-4 rounded text-[9px]',
  sm: 'h-7 w-7 rounded-lg text-sm',
  md: 'h-8 w-8 rounded-lg',
} as const;

/** The "◈" brand mark on the `--brand-gradient` token. Decorative by default (the adjacent "Polaris" text names it); pass `label` when it stands alone. */
export function LogoMark({
  size = 'sm',
  label,
  className,
}: {
  size?: keyof typeof SIZES;
  label?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      className={cn('flex items-center justify-center text-white', SIZES[size], className)}
      style={{ background: 'var(--brand-gradient)' }}
    >
      ◈
    </span>
  );
}
