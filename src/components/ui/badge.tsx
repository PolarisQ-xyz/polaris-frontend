import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    tone: {
      neutral: 'bg-[var(--surface-2)] text-[var(--ink-soft)]',
      accent: 'bg-[var(--accent-soft)] text-[var(--accent-ink)]',
      yes: 'bg-[var(--yes-soft)] text-[var(--yes)]',
      no: 'bg-[var(--no-soft)] text-[var(--no)]',
      warn: 'bg-[var(--warn-soft)] text-[var(--warn)]',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
