import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  let hasRefreshed = false;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        const promptUpdate = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.postMessage({ type: 'SKIP_WAITING' });
        };

        if (registration.waiting) {
          promptUpdate(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              promptUpdate(newWorker);
            }
          });
        });

        setInterval(() => {
          registration.update().catch(() => undefined);
        }, 60000);
      })
      .catch((error) => {
        console.error('Erro ao registrar o service worker:', error);
      });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasRefreshed) return;
    hasRefreshed = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(<App />);
