import React from 'react';
import { createRoot } from 'react-dom/client';
import { PedigreeWorkspace } from '../components/pedigree-workspace';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PedigreeWorkspace />
  </React.StrictMode>,
);
