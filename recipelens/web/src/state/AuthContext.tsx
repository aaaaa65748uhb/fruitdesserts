import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, onUnauthorized, type ApiUser } from '../lib/api.js';
import { ensureRuntimeReady, needsServerSetup } from '../lib/runtime.js';

interface AuthContextValue {
  user: ApiUser | null;
  loading: boolean;
  error: ApiError | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: ApiUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Wait for the backend address before asking who is signed in, otherwise a
    // stored session would be discarded on every cold start of the Android app.
    void ensureRuntimeReady().then(async () => {
      if (cancelled) return;
      if (needsServerSetup()) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const response = await api.auth.me();
        if (!cancelled) setUser(response.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 from anywhere means the session is gone — reflect it immediately.
  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const response = await api.auth.login(email, password);
    setUser(response.user);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    setError(null);
    const response = await api.auth.register(email, password, displayName);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, error, login, register, logout, setUser }),
    [user, loading, error, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
