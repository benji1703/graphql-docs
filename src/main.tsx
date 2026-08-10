import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { SchemaProvider } from './context/SchemaContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <SchemaProvider>
        <App />
      </SchemaProvider>
    </HashRouter>
  </StrictMode>,
);
