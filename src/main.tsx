import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Schriften lokal buendeln: die App ist local-first und muss offline identisch
// rendern -- kein CDN. IBM Plex Sans (Oberflaeche), IBM Plex Mono (Zahlen/Daten).
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import { App } from './ui/app/App';
import { I18nProvider } from './ui/i18n';
import './ui/styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing in index.html');

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);

// Service Worker nur in Produktion registrieren (Entwicklung bleibt ohne Caching).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => console.warn('SW-Registrierung fehlgeschlagen', error));
  });
}
