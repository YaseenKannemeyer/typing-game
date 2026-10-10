import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AchievementProvider } from './components/achievements/Achievements';
import { ToastProvider } from './components/Toasts';
import { SoundProvider } from './game/sound';
import './index.css';

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
