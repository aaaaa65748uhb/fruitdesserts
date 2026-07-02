'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ADMIN_EMAIL, getFirebaseAuth, isDemoMode } from '@/lib/firebase';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isDemo: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  demoSignIn: (asAdmin: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// התמדת משתמש דמו בין רענונים — נתוני דמו בלבד, לא משמש לאבטחה.
// במצב Firebase האימות מנוהל כולו על ידי Firebase Auth SDK.
const DEMO_USER_KEY = 'squidget-demo-user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      try {
        const raw = window.sessionStorage.getItem(DEMO_USER_KEY);
        if (raw) setUser(JSON.parse(raw) as AuthUser);
      } catch {
        // אין אחסון — נמשיך ללא משתמש
      }
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            displayName: firebaseUser.displayName ?? 'לקוח Squidget',
            photoURL: firebaseUser.photoURL,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    });
    return () => unsubscribe?.();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (isDemoMode) return;
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  }, []);

  const signOut = useCallback(async () => {
    if (isDemoMode) {
      setUser(null);
      try {
        window.sessionStorage.removeItem(DEMO_USER_KEY);
      } catch {
        // אין אחסון
      }
      return;
    }
    const { signOut: firebaseSignOut } = await import('firebase/auth');
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const demoSignIn = useCallback((asAdmin: boolean) => {
    if (!isDemoMode) return;
    const demoUser: AuthUser = asAdmin
      ? { uid: 'demo-admin', email: ADMIN_EMAIL, displayName: 'מנהל Squidget (דמו)', photoURL: null }
      : { uid: 'demo-customer', email: 'demo.customer@example.com', displayName: 'לקוח דמו', photoURL: null };
    setUser(demoUser);
    try {
      window.sessionStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
    } catch {
      // אין אחסון
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: !!user && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
      isDemo: isDemoMode,
      signInWithGoogle,
      signOut,
      demoSignIn,
    }),
    [user, loading, signInWithGoogle, signOut, demoSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth חייב לרוץ בתוך AuthProvider');
  return ctx;
}
