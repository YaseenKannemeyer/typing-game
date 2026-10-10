import { useState } from 'react';
import { lobbyCodeFromPath, usePath } from './lib/router';
import { loadName } from './lib/storage';
import { Home } from './screens/Home';
import { LobbyScreen } from './screens/LobbyScreen';
import { NameGate } from './screens/NameGate';
import { NotFound } from './screens/NotFound';

export default function App() {
  const path = usePath();
  const code = lobbyCodeFromPath(path);
  // null = use the saved name (Home may have just saved one); '' = ask again.
  const [name, setName] = useState<string | null>(null);
  const current = name ?? loadName();

  if (path === '/' || path === '') return <Home />;
  if (!code) return <NotFound />;
  if (!current) return <NameGate code={code} onName={setName} />;
  return <LobbyScreen key={`${code}:${current}`} code={code} name={current} onChangeName={() => setName('')} />;
}
