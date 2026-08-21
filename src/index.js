import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useAppUpdateCheck } from './app-update';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

function Root() {
  useAppUpdateCheck();
  return <App />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><Root /></React.StrictMode>);

const loader = document.getElementById('root-loader');
if (loader) {
  requestAnimationFrame(() => {
    loader.remove();
    window.scrollTo(0, 0);
  });
}
