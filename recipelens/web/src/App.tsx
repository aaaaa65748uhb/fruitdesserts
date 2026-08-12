import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { AppShell } from './components/AppShell.js';
import { LoadingScreen } from './components/feedback.js';
import { initNativeShell, useAndroidBackButton, useOnline } from './lib/nativeShell.js';
import { ensureRuntimeReady, needsServerSetup } from './lib/runtime.js';
import { ServerSetup } from './components/ServerSetup.js';
import { useAuth } from './state/AuthContext.js';
import { ShareProvider } from './state/ShareContext.js';
import { AuthPage } from './pages/AuthPage.js';
import { CollectionsPage } from './pages/CollectionsPage.js';
import { CookPage } from './pages/CookPage.js';
import { HomePage } from './pages/HomePage.js';
import { ImportPage } from './pages/ImportPage.js';
import { RecipeEditPage } from './pages/RecipeEditPage.js';
import { RecipePage } from './pages/RecipePage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ShoppingPage } from './pages/ShoppingPage.js';

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen label="Checking your session…" />;
  // Frontend routing is convenience only — the API authorises every request.
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return children;
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-neutral-900 px-3 py-2 text-sm text-white" role="status">
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      You are offline — saved recipes still open, new imports will fail.
    </div>
  );
}

export function App() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The Android build has to know which backend to talk to before anything
  // else can happen; the browser build is always same-origin.
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [askForServer, setAskForServer] = useState(false);

  useEffect(() => {
    void initNativeShell();
    void ensureRuntimeReady().then(() => {
      setAskForServer(needsServerSetup());
      setRuntimeReady(true);
    });
  }, []);

  // Android back button: leave the app only from the home screen.
  const canGoBack = useCallback(() => location.pathname !== '/' && location.pathname !== '/sign-in', [location.pathname]);
  const goBack = useCallback(() => navigate(-1), [navigate]);
  useAndroidBackButton(canGoBack, goBack);

  if (!runtimeReady) return <LoadingScreen label="Starting RecipeLens…" />;
  if (askForServer) {
    return (
      <ServerSetup
        onConnected={() => {
          setUser(null);
          setAskForServer(false);
        }}
      />
    );
  }

  return (
    <ShareProvider>
      <OfflineBanner />
      <Routes>
        <Route
          path="/sign-in"
          element={loading ? <LoadingScreen /> : user ? <Navigate to="/" replace /> : <AuthPage mode="sign-in" />}
        />
        <Route
          path="/sign-up"
          element={loading ? <LoadingScreen /> : user ? <Navigate to="/" replace /> : <AuthPage mode="sign-up" />}
        />
        <Route
          path="*"
          element={
            <RequireAuth>
              <AppShell>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/recipes/:id" element={<RecipePage />} />
                  <Route path="/recipes/:id/edit" element={<RecipeEditPage />} />
                  <Route path="/recipes/:id/cook" element={<CookPage />} />
                  <Route path="/shopping" element={<ShoppingPage />} />
                  <Route path="/collections" element={<CollectionsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </RequireAuth>
          }
        />
      </Routes>
    </ShareProvider>
  );
}
