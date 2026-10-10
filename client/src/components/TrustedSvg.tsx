import { memo } from 'react';

/**
 * Injects SVG markup produced by our own art renderers (client/src/art), which
 * escape every dynamic value. Never pass player- or server-provided markup.
 */
export const TrustedSvg = memo(function TrustedSvg({ markup, className }: { markup: string; className?: string }) {
  return <span className={className} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: markup }} />;
});
