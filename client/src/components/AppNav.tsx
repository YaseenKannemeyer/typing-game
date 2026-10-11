import type { MouseEvent } from 'react';
import { navigate, usePath } from '../lib/router';
import { useAuth } from '../game/useAuth';

/** Site navigation (kit 15 `.a-nav`). Guests see "Save progress" instead of "Profile". */
export function AppNav() {
  const path = usePath();
  const { permanent, ready } = useAuth();
  const links = [
    { href: '/', label: 'Race' },
    { href: '/leaderboard', label: 'Hall of fame' },
    permanent ? { href: '/profile', label: 'Profile' } : { href: '/account', label: ready ? 'Save progress' : 'Account' },
  ];
  const go = (href: string) => (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return (
    <nav className="a-nav" aria-label="Main">
      {links.map((l) => (
        <a key={l.href} href={l.href} onClick={go(l.href)} aria-current={path === l.href || (l.href === '/' && path.startsWith('/r/')) ? 'page' : undefined}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
