import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useAppUpdateCheck } from './app-update';

function Root() {
  useAppUpdateCheck();
  return <App />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><Root /></React.StrictMode>);

/* Remove the pre-React loader spinner */
const loader = document.getElementById('root-loader');
if (loader) setTimeout(() => loader.remove(), 100);
