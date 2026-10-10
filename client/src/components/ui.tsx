import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { iconSvg, markSvg, type IconName } from '../art/gridArt';
import { AppNav } from './AppNav';
import { TrustedSvg } from './TrustedSvg';

/* React versions of the GRID UI kit (02-ui/core.js, 01-brand/brand.js). */

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <TrustedSvg markup={iconSvg(name, size)} />;
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  variant = 'primary',
  icon,
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; loading?: boolean }) {
  return (
    <button
      type="button"
      className={`g-btn g-btn--${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="g-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`g-panel ${className}`}>{children}</section>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="g-field-error" role="alert">{children}</p> : null;
}

export type Tone = 'info' | 'error' | 'success' | 'warning';

export function Banner({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`g-banner g-banner--${tone}`}>
      <Icon name={tone === 'error' ? 'alert' : tone === 'success' ? 'check' : 'wifi'} />
      <span>{children}</span>
    </div>
  );
}

export function Pill({ children, lime = false }: { children: ReactNode; lime?: boolean }) {
  return <span className={`g-pill ${lime ? 'g-pill--lime' : ''}`}>{children}</span>;
}

export function SectionTitle({ eyebrow, title, aside }: { eyebrow?: string; title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="g-between">
      <div>
        {eyebrow && <p className="g-eyebrow">{eyebrow}</p>}
        <h2 className="g-heading mt-1">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

export function PageTitle({ eyebrow, title, lead }: { eyebrow: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <div>
      <p className="g-eyebrow">{eyebrow}</p>
      <h1 className="g-title">{title}</h1>
      {lead && <p className="g-muted">{lead}</p>}
    </div>
  );
}

export function Skeleton() {
  return (
    <div className="g-skeleton" role="status" aria-label="Loading">
      <span />
      <span />
      <span />
    </div>
  );
}

export function Mark({ size = 44 }: { size?: number }) {
  return <TrustedSvg markup={markSvg(size)} />;
}

/** Brand lockup (01-brand wordmark). */
export function Brand() {
  return (
    <span className="g-brand">
      <Mark size={36} />
      <span>
        GRID <i>/</i>
        <small>TYPE RACING</small>
      </span>
    </span>
  );
}

/** Branded loading state (01-brand loading()). */
export function Loading({ label = 'Preparing the starting grid' }: { label?: string }) {
  return (
    <div className="g-loading">
      <Mark size={64} />
      <h2>{label}</h2>
      <p className="g-muted">Your next race is just around the corner.</p>
      <span className="g-loader-road" aria-hidden="true" />
      <span className="g-sr" role="status">Loading</span>
    </div>
  );
}

export function Page({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-fg">
      <header className="border-b border-line">
        {/* Phones: brand + actions on one row, nav on its own scrollable row. Desktop: one row. */}
        <div className="app-header mx-auto max-w-6xl px-4">
          <Brand />
          <AppNav />
          <div className="app-header-actions">{actions}</div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">{children}</main>
    </div>
  );
}
