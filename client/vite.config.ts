import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Invite previews need an absolute HTTPS image URL. When VITE_PUBLIC_URL is set
 * (e.g. https://grid.example.com) the og:image/og:url tags are added; without
 * it they are omitted rather than pointing at an unreachable relative path.
 */
function openGraph(publicUrl: string | undefined): Plugin {
  return {
    name: 'open-graph-image',
    transformIndexHtml() {
      if (!publicUrl) return [];
      const base = publicUrl.replace(/\/$/, '');
      const meta = (property: string, content: string) => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' as const });
      return [
        meta('og:url', base),
        meta('og:image', `${base}/invite-preview.png`),
        meta('og:image:width', '1200'),
        meta('og:image:height', '630'),
        meta('og:image:alt', 'GRID / Type Racing invitation'),
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return { plugins: [react(), tailwindcss(), openGraph(env.VITE_PUBLIC_URL)] };
});
