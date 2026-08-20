import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AnmeldungProvider } from './lib/auth';
import { HinweiseProvider } from './components/Hinweise';
import './styles/global.css';

const wurzel = document.getElementById('root');
if (!wurzel) throw new Error('Das Element mit der id "root" fehlt in index.html.');

createRoot(wurzel).render(
  <StrictMode>
    <HinweiseProvider>
      <AnmeldungProvider>
        <App />
      </AnmeldungProvider>
    </HinweiseProvider>
  </StrictMode>,
);
