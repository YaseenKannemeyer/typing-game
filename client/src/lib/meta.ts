import { useEffect } from 'react';

const SITE = 'GRID';
const ORIGIN = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) || window.location.origin).replace(/\/$/, '');

export interface PageMeta {
  /** Shown before " · GRID" in the browser tab. */
  title: string;
  description?: string;
  /** Canonical path. Omit for private or throwaway pages (they also get noindex). */
  canonical?: string;
}

function setMeta(name: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (content === null) return el?.remove();
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.append(el);
  }
  el.content = content;
}

function setCanonical(path: string | undefined) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (path === undefined) return el?.remove();
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.append(el);
  }
  el.href = `${ORIGIN}${path}`;
}

/** BreadcrumbList structured data (Home › page) for indexable pages below the root. */
function setBreadcrumb(title: string, path: string | undefined) {
  document.getElementById('breadcrumb-ld')?.remove();
  if (!path || path === '/') return;
  const el = document.createElement('script');
  el.id = 'breadcrumb-ld';
  el.type = 'application/ld+json';
  el.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: title, item: `${ORIGIN}${path}` },
    ],
  });
  document.head.append(el);
}

/** Per-route tab title, description, canonical link, robots directive and breadcrumb. */
export function usePageMeta({ title, description, canonical }: PageMeta) {
  useEffect(() => {
    document.title = `${title} · ${SITE}`;
    if (description) setMeta('description', description);
    setCanonical(canonical);
    setMeta('robots', canonical === undefined ? 'noindex' : null);
    setBreadcrumb(title, canonical);
  }, [title, description, canonical]);
}
