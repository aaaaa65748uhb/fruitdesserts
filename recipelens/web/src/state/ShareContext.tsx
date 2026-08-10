/**
 * Android share target → import screen.
 *
 * "Share to RecipeLens" from TikTok/Instagram/YouTube delivers a URL through
 * the native SharedIntent plugin; this provider routes the app to /import with
 * the link already filled in, whether the app was cold-started by the share or
 * was already open.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumePendingShare, isNative, onShare, type SharedItem } from '../lib/runtime.js';

interface ShareContextValue {
  /** The most recent shared payload that has not been consumed by a screen. */
  pending: SharedItem | null;
  consume: () => SharedItem | null;
  /** Used by the web build (and tests) to simulate a share. */
  push: (item: SharedItem) => void;
}

const ShareContext = createContext<ShareContextValue | null>(null);

export function ShareProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<SharedItem | null>(null);
  const navigate = useNavigate();

  const push = useCallback(
    (item: SharedItem) => {
      setPending(item);
      navigate('/import', { state: { shared: true } });
    },
    [navigate],
  );

  useEffect(() => {
    if (!isNative) return undefined;
    let cancelled = false;

    void consumePendingShare().then((item) => {
      if (item && !cancelled) push(item);
    });

    let unsubscribe: (() => void) | undefined;
    void onShare((item) => {
      if (!cancelled) push(item);
    }).then((remove) => {
      unsubscribe = remove;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [push]);

  const consume = useCallback(() => {
    let item: SharedItem | null = null;
    setPending((current) => {
      item = current;
      return null;
    });
    return item;
  }, []);

  const value = useMemo<ShareContextValue>(() => ({ pending, consume, push }), [pending, consume, push]);
  return <ShareContext.Provider value={value}>{children}</ShareContext.Provider>;
}

export function useShare(): ShareContextValue {
  const context = useContext(ShareContext);
  if (!context) throw new Error('useShare must be used inside <ShareProvider>');
  return context;
}
