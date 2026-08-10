/**
 * Android share target → import screen.
 *
 * "Share to RecipeLens" from TikTok/Instagram/YouTube delivers a URL through
 * the native SharedIntent plugin; this provider routes the app to /import with
 * the link already filled in, whether the app was cold-started by the share or
 * was already open.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  // The value is mirrored in a ref: `consume()` has to return it synchronously,
  // and a state updater does not run at call time.
  const pendingRef = useRef<SharedItem | null>(null);
  const navigate = useNavigate();

  const push = useCallback(
    (item: SharedItem) => {
      pendingRef.current = item;
      setPending(item);
      navigate('/import', { state: { shared: true } });
    },
    [navigate],
  );

  // `push` changes identity whenever the router navigates, so the subscription
  // reads it through a ref and is set up exactly once.
  const pushRef = useRef(push);
  pushRef.current = push;

  /**
   * Android can hand the same intent over more than once (re-delivery after a
   * configuration change, a duplicated listener). Ignoring an identical payload
   * that arrives within a few seconds keeps one share from becoming two imports,
   * while genuinely sharing the same link again later still works.
   */
  const lastDelivery = useRef<{ key: string; at: number } | null>(null);
  const deliver = useCallback((item: SharedItem) => {
    const key = `${item.type}:${item.value}`;
    const now = Date.now();
    if (lastDelivery.current && lastDelivery.current.key === key && now - lastDelivery.current.at < 5000) return;
    lastDelivery.current = { key, at: now };
    pushRef.current(item);
  }, []);

  useEffect(() => {
    if (!isNative) return undefined;
    let cancelled = false;

    void consumePendingShare().then((item) => {
      if (item && !cancelled) deliver(item);
    });

    let unsubscribe: (() => void) | undefined;
    void onShare((item) => {
      if (!cancelled) deliver(item);
    }).then((remove) => {
      unsubscribe = remove;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [deliver]);

  const consume = useCallback(() => {
    const item = pendingRef.current;
    pendingRef.current = null;
    if (item) setPending(null);
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
