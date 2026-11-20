'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/cn';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Why Polaris' },
  { href: '#try-it', label: 'Try it live' },
  { href: '#faq', label: 'FAQ' },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-shadow duration-300',
        scrolled
          ? 'border-b border-[var(--line)] bg-[var(--bg)]/85 shadow-sm backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/welcome" className="flex items-center gap-2 text-lg font-bold">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ background: 'linear-gradient(135deg, #5b4fe0, #8b7bff)' }}
          >
            ◈
          </span>
          Polaris
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 text-sm font-medium text-[var(--ink-soft)] md:flex"
        >
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-[var(--ink)]">
              {link.label}
            </a>
          ))}
        </nav>

        <Link href="/" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
          Launch app
        </Link>
      </div>
    </header>
  );
}
