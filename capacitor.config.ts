import type { CapacitorConfig } from '@capacitor/cli';

const target = process.env.CAPACITOR_TARGET === 'doctor' ? 'doctor' : 'patient';
const debugHttp = process.env.CAPACITOR_DEBUG_HTTP === 'true';

const config: CapacitorConfig = {
  appId: target === 'doctor' ? 'com.oneminute.healthcare.doctor' : 'com.oneminute.healthcare.patient',
  appName: target === 'doctor' ? 'OneMinute Doctor' : 'OneMinute Healthcare',
  webDir: target === 'doctor' ? 'dist-doctor' : 'dist-patient',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#F7FBFC',
  },
  ios: {
    backgroundColor: '#F7FBFC',
  },
  plugins: target === 'patient' ? {
    CapacitorUpdater: {
      appId: 'com.oneminute.healthcare.patient',
      autoUpdate: 'atBackground',
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      keepUrlPathAfterReload: true,
    },
  } : undefined,
  server: debugHttp ? { cleartext: true } : undefined,
};

export default config;
