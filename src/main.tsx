import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import './tokens.css';
import './index.css';
import App from './App.tsx';

const radice = document.getElementById('root');
if (!radice) throw new Error('index.html non ha l\'elemento #root');

createRoot(radice).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
