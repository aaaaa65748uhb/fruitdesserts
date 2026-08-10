import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell.js';
import { LoadingScreen } from './components/feedback.js';
import { useAuth } from './state/AuthContext.js';
import { AuthPage } from './pages/AuthPage.js';
import { CollectionsPage } from './pages/CollectionsPage.js';
import { CookPage } from './pages/CookPage.js';
import { HomePage } from './pages/HomePage.js';
import { ImportPage } from './pages/ImportPage.js';
import { RecipeEditPage } from './pages/RecipeEditPage.js';
import { RecipePage } from './pages/RecipePage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ShoppingPage } from './pages/ShoppingPage.js';
import type { ReactElement } from 'react';

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen label="Checking your session…" />;
  // Frontend routing is convenience only — the API authorises every request.
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return children;
}

export function App() {
  const { user, loading } = useAuth();

  return (
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
  );
}
