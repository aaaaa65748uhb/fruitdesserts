/**
 * Google Sign-In for the browser build, using Google Identity Services.
 *
 * The button is only rendered when the *server* reports that it can verify
 * Google tokens (GOOGLE_CLIENT_ID set), so it is never a dead control. The ID
 * token it produces is verified server-side before any session is issued.
 *
 * The Android build signs in with email and password; adding Google there
 * needs a native credential plugin, which this build does not include.
 */
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api.js';
import { isNative } from '../lib/runtime.js';
import { useAuth } from '../state/AuthContext.js';

const SCRIPT_ID = 'google-identity-services';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('load failed')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('load failed'));
    document.head.appendChild(script);
  });
}

export function GoogleSignInButton({
  onSignedIn,
  onError,
}: {
  onSignedIn: () => void;
  onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const { setUser } = useAuth();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (isNative) {
      setUnavailable(true);
      return undefined;
    }
    let cancelled = false;

    void (async () => {
      let clientId: string | null = null;
      try {
        const config = await api.auth.googleConfig();
        clientId = config.clientId;
      } catch {
        clientId = null;
      }
      if (!clientId || cancelled) {
        setUnavailable(true);
        return;
      }

      try {
        await loadScript();
      } catch {
        if (!cancelled) setUnavailable(true);
        return;
      }
      if (cancelled || !container.current || !window.google?.accounts?.id) {
        setUnavailable(true);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response.credential) {
            onError('Google did not return a sign-in token.');
            return;
          }
          void api.auth
            .google(response.credential)
            .then((result) => {
              setUser(result.user);
              onSignedIn();
            })
            .catch((error: unknown) => {
              onError(error instanceof ApiError ? error.message : 'That Google sign-in could not be completed.');
            });
        },
      });
      window.google.accounts.id.renderButton(container.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [onError, onSignedIn, setUser]);

  if (unavailable) return null;
  return <div ref={container} className="flex justify-center" aria-label="Sign in with Google" />;
}
