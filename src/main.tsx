import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import './index.css';
import App from './App';
import { AuthProvider } from './auth/AuthContext';

if (import.meta.env.MODE === 'patient' && Capacitor.isNativePlatform()) {
  void CapacitorUpdater.notifyAppReady();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter>
  </StrictMode>,
);
