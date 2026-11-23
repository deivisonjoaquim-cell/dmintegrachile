import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Google Maps Platform Demo Key Quota Defense (Tier 1):
// Register before React mounts so auth/quota events from Maps JS API are never missed.
declare global {
  interface Window {
    gm_authFailure?: () => void;
    __gmpQuotaTapInstalled?: boolean;
  }
}

if (typeof window !== 'undefined' && !window.__gmpQuotaTapInstalled) {
  window.__gmpQuotaTapInstalled = true;

  window.gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const joined = args
        .map((arg) => (typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : ''))
        .join(' ');
      if (joined.includes('OverQuotaMapError') || joined.includes('QuotaExceededError')) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    } catch {
      // Never block error logging
    }
    originalConsoleError(...args);
  };
}

createRoot(document.getElementById('root')!).render(<App />);

