import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AchievementProvider } from './components/achievements/Achievements';
import { ToastProvider } from './components/Toasts';
import { SoundProvider } from './game/sound';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';
import './styles/studio.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <ToastProvider>
        <AchievementProvider>
          <App />
        </AchievementProvider>
      </ToastProvider>
    </SoundProvider>
  </StrictMode>,
);
