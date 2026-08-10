import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the same web client that runs in the browser.
 *
 * The APK ships only static assets: it holds no AI key and no database
 * credentials, and talks exclusively to the backend named by
 * VITE_API_BASE_URL at build time (see web/src/lib/runtime.ts).
 */
const config: CapacitorConfig = {
  appId: 'com.recipelens.app',
  appName: 'RecipeLens',
  webDir: 'web/dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#fb5607',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;
