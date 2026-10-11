import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MotionPreference } from './components/MotionPreference';
import { applyComfort, loadComfort } from './lib/comfort';
import { AchievementProvider } from './components/achievements/Achievements';
import { ToastProvider } from './components/Toasts';
import { SoundProvider } from './game/sound';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';
import './styles/studio.css';
import './styles/spectator.css';
import './styles/experience.css';

// Before the first paint, so the saved text size and contrast never flash.
applyComfort(loadComfort());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <ToastProvider>
        <AchievementProvider>
          <MotionPreference>
            <App />
          </MotionPreference>
        </AchievementProvider>
      </ToastProvider>
    </SoundProvider>
  </StrictMode>,
);
