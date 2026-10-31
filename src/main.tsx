import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { applyLocale, applyTheme, useUi } from './state/ui';

// Apply the persisted preferences before the first paint so there is no flash of
// the wrong theme or language.
const initial = useUi.getState();
applyTheme(initial.theme);
applyLocale(initial.locale);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
