import { lazy, Suspense, useState } from 'react';
import { Loading, Page } from './components/ui';
import { usePageMeta, type PageMeta } from './lib/meta';
import { lobbyCodeFromPath, usePath } from './lib/router';
import { loadName } from './lib/storage';
import { Home } from './screens/Home';
import { NameGate } from './screens/NameGate';
import { NotFound } from './screens/NotFound';

// Split by route: the race screens (framer-motion), account and leaderboard load on demand.
const AccountScreen = lazy(() => import('./screens/AccountScreen').then((m) => ({ default: m.AccountScreen })));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen').then((m) => ({ default: m.ProfileScreen })));
const LeaderboardScreen = lazy(() => import('./screens/LeaderboardScreen').then((m) => ({ default: m.LeaderboardScreen })));
const LobbyScreen = lazy(() => import('./screens/LobbyScreen').then((m) => ({ default: m.LobbyScreen })));

const HOME_META: PageMeta = {
  title: 'Multiplayer Type Racing',
  description: 'Race up to 15 friends in real time. Same passage, same countdown. Only your typing decides who wins.',
  canonical: '/',
};
const ROUTE_META: Record<string, PageMeta> = {
  '/account': { title: 'Account', description: 'Sign in or save your guest progress to keep your trophies, charts and hall of fame spot.' },
  '/profile': { title: 'Your profile', description: 'Your race history, WPM and accuracy charts, and trophy cabinet.' },
  '/leaderboard': {
    title: 'Hall of Fame',
    description: 'The fastest GRID typists this week, this month and of all time, ranked by WPM.',
    canonical: '/leaderboard',
  },
};

function routeMeta(path: string, code: string | null): PageMeta {
  if (path === '/' || path === '') return HOME_META;
  if (ROUTE_META[path]) return ROUTE_META[path];
  if (code) return { title: `Room ${code}`, description: 'You are invited to a GRID type race. Pick a name and join the starting grid.' };
  return { title: 'Page not found', description: 'This page does not exist.' };
}

export default function App() {
  const path = usePath();
  const code = lobbyCodeFromPath(path);
  // null = use the saved name (Home may have just saved one); '' = ask again.
  const [name, setName] = useState<string | null>(null);
  const current = name ?? loadName();
  usePageMeta(routeMeta(path, code));

  return (
    <Suspense
      fallback={
        <Page>
          <Loading label="Loading" />
        </Page>
      }
    >
      {route()}
    </Suspense>
  );

  function route() {
    if (path === '/' || path === '') return <Home />;
    if (path === '/account') return <AccountScreen />;
    if (path === '/profile') return <ProfileScreen />;
    if (path === '/leaderboard') return <LeaderboardScreen />;
    if (!code) return <NotFound />;
    if (!current) return <NameGate code={code} onName={setName} />;
    return <LobbyScreen key={`${code}:${current}`} code={code} name={current} onChangeName={() => setName('')} />;
  }
}
