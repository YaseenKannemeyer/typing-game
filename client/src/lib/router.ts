import { useEffect, useState } from 'react';

export function navigate(path: string) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function usePath(): string {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export function lobbyCodeFromPath(path: string): string | null {
  return /^\/r\/([A-Za-z0-9]{6})\/?$/.exec(path)?.[1]?.toUpperCase() ?? null;
}

export function lobbyLink(code: string): string {
  return `${window.location.origin}/r/${code}`;
}

/** `/r/CODE/watch`: the read-only spectator view of a room. */
export function watchCodeFromPath(path: string): string | null {
  return /^\/r\/([A-Za-z0-9]{6})\/watch\/?$/.exec(path)?.[1]?.toUpperCase() ?? null;
}

export function watchLink(code: string): string {
  return `${window.location.origin}/r/${code}/watch`;
}
