/**
 * First-run screen on Android: where does your RecipeLens server live?
 *
 * One APK works with any backend — the address is entered here, verified
 * against /api/health before it is stored, and kept in Capacitor Preferences.
 * No rebuild is needed when the server moves.
 */
import { CheckCircle2, Loader2, Server } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { BrandMark } from './AppShell.js';
import { InlineError } from './feedback.js';
import { checkServer, setApiBaseUrl, type ServerCheck } from '../lib/runtime.js';

export function ServerSetup({ onConnected, onCancel }: { onConnected: () => void; onCancel?: () => void }) {
  const [address, setAddress] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ServerCheck | null>(null);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setChecking(true);
    try {
      const check = await checkServer(address);
      if (!check.ok) {
        setError(check.message ?? 'Could not reach that server.');
        return;
      }
      setResult(check);
      await setApiBaseUrl(check.baseUrl);
      onConnected();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that address.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <BrandMark />
        <p className="mt-3 text-sm text-neutral-600">
          RecipeLens keeps your recipes on your own server. Tell the app where it is — you only do this once.
        </p>
      </div>

      <form onSubmit={connect} className="card space-y-4 p-5" noValidate>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Server className="h-5 w-5 text-brand-500" aria-hidden="true" />
          Server address
        </h1>

        <div>
          <label className="label" htmlFor="server-address">
            Address
          </label>
          <input
            id="server-address"
            className="field"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="recipelens-xxxx.onrender.com"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Paste the address your host gave you. https:// is added for you.
          </p>
          <InlineError message={error} />
        </div>

        {result?.ok ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Connected{result.aiConfigured ? ` — AI ready (${result.aiProvider})` : ' — AI not configured on that server yet'}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={checking || address.trim().length === 0}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {checking ? 'Checking…' : 'Connect'}
        </button>

        {onCancel ? (
          <button type="button" className="btn-ghost w-full" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </form>
    </div>
  );
}
