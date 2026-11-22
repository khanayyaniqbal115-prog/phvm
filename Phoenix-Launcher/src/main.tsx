import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initLite } from './utils/lite';

initLite();

// The Android app has no local server: send /api/* requests to the hosted Phoenix web version
// (set VITE_API_BASE at build time, e.g. https://your-site.netlify.app). Empty = same origin.
const apiBase = (((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE) || '').replace(/\/$/, '');
if (apiBase) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) =>
    typeof input === 'string' && input.startsWith('/api/') ? nativeFetch(apiBase + input, init) : nativeFetch(input, init);
}

createRoot(document.getElementById('root')!).render(<App />);
