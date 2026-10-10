import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const NAME = 'GRID';
const DESCRIPTION = 'Race up to 15 friends in real time. Same passage, same countdown. Only your typing decides who wins.';
/** Public, indexable pages. Rooms, account and profile pages are private and send noindex (vercel.json). */
const PAGES = ['/', '/leaderboard'];

/**
 * Everything that needs the absolute public URL (VITE_PUBLIC_URL, e.g. https://grid.example.com):
 * canonical, og:image/og:url, twitter:image, JSON-LD and sitemap.xml. Without it they are
 * omitted rather than pointing at an unreachable relative path.
 */
function siteMeta(publicUrl: string | undefined): Plugin {
  const base = publicUrl?.replace(/\/$/, '');
  return {
    name: 'site-meta',
    enforce: 'post',
    transformIndexHtml() {
      if (!base) return [];
      const meta = (property: string, content: string): HtmlTagDescriptor => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' });
      const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', '@id': `${base}/#website`, url: `${base}/`, name: NAME, description: DESCRIPTION, inLanguage: 'en' },
          {
            '@type': ['VideoGame', 'WebApplication'],
            '@id': `${base}/#game`,
            name: `${NAME} Type Racing`,
            url: `${base}/`,
            description: DESCRIPTION,
            image: `${base}/invite-preview.png`,
            applicationCategory: 'GameApplication',
            genre: ['Typing game', 'Racing'],
            playMode: ['MultiPlayer', 'SinglePlayer'],
            numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 15 },
            operatingSystem: 'Any (web browser)',
            gamePlatform: 'Web browser',
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            isPartOf: { '@id': `${base}/#website` },
          },
        ],
      };
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: `${base}/` }, injectTo: 'head' },
        meta('og:url', `${base}/`),
        meta('og:image', `${base}/invite-preview.png`),
        meta('og:image:width', '1200'),
        meta('og:image:height', '630'),
        meta('og:image:alt', 'GRID / Type Racing invite: "Bring your crew. Find your fast." beside a teal race car, number 4'),
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${base}/invite-preview.png` }, injectTo: 'head' },
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(jsonLd), injectTo: 'head' },
      ];
    },
    generateBundle(_, bundle) {
      const file = (fileName: string, source: string | Uint8Array) => this.emitFile({ type: 'asset', fileName, source });
      file('robots.txt', `User-agent: *\nAllow: /\n${base ? `\nSitemap: ${base}/sitemap.xml\n` : ''}`);
      if (base) {
        const urls = PAGES.map((p) => `  <url><loc>${base}${p}</loc></url>`).join('\n');
        file('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
      }
      const link = (p: string) => (base ? `${base}${p}` : p);
      file(
        'llms.txt',
        `# ${NAME} Type Racing

> A free multiplayer typing race in the browser. Up to 15 people join a room with a 6-character code or an invite link, vote on the kind of passage, then type the same text against the same countdown. Ranking is by words per minute.

- No account needed: guests race straight away and can later save their progress to an email account.
- The host picks the race length (1 to 5 minutes) and an optional zero-mistake mode.
- Trophies are awarded by the server after each race; accounts get a profile with WPM and accuracy charts.
- There is a solo practice track on the home page.

## Pages

- [Home](${link('/')}): create a room, join one with a code, or practise solo
- [Hall of Fame](${link('/leaderboard')}): fastest racers this week, this month and of all time
`,
      );
      // Vercel serves 404.html (with a 404 status) for unknown paths; it boots the app, which shows the 404 screen.
      const index = bundle['index.html'];
      if (index?.type === 'asset') file('404.html', index.source);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react(), tailwindcss(), siteMeta(env.VITE_PUBLIC_URL)],
    build: {
      sourcemap: false,
      rolldownOptions: {
        output: {
          // Vendor code changes less often than app code, so it gets its own long-cached chunks.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
              { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
