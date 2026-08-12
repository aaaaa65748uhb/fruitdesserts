import { LogOut, Server, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/AppShell.js';
import { InlineError, Spinner } from '../components/feedback.js';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useAuth } from '../state/AuthContext.js';
import { ServerSetup } from '../components/ServerSetup.js';
import { currentApiBaseUrl, isNative } from '../lib/runtime.js';

export function SettingsPage() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const health = useAsync(() => api.health(), []);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changingServer, setChangingServer] = useState(false);

  async function saveProfile() {
    setError(null);
    setMessage(null);
    if (!displayName.trim()) {
      setError('Tell us what to call you.');
      return;
    }
    setSaving(true);
    try {
      const response = await api.auth.updateProfile(displayName.trim());
      setUser(response.user);
      setMessage('Saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your name.');
    } finally {
      setSaving(false);
    }
  }

  if (changingServer) {
    return (
      <ServerSetup
        onConnected={() => {
          setChangingServer(false);
          void logout().then(() => navigate('/sign-in', { replace: true }));
        }}
        onCancel={() => setChangingServer(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle={user?.email} />

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Your profile</h2>
        <div>
          <label className="label" htmlFor="displayName">
            Display name
          </label>
          <input id="displayName" className="field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} />
          <InlineError message={error} />
          {message ? <p className="mt-1 text-sm text-emerald-700">{message}</p> : null}
        </div>
        <button type="button" className="btn-primary" onClick={() => void saveProfile()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" />
          AI analysis
        </h2>
        {health.loading ? <Spinner /> : null}
        {health.data ? (
          health.data.ai.configured ? (
            <p className="text-sm text-neutral-700">
              Configured — {health.data.ai.provider} / {health.data.ai.model}. Analysis runs on the server; your browser never sees the
              API key.
            </p>
          ) : (
            <p className="text-sm text-neutral-700">
              Not configured on this server. Links with machine-readable recipes still import, and you can add recipes by hand.
            </p>
          )
        ) : null}
        {health.error ? <p className="text-sm text-red-700">Could not reach the server just now.</p> : null}
      </section>

      {isNative ? (
        <section className="card space-y-2 p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Server className="h-4 w-4 text-brand-500" aria-hidden="true" />
            Server
          </h2>
          <p className="break-all text-sm text-neutral-700">{currentApiBaseUrl() ?? 'Not set'}</p>
          <p className="text-xs text-neutral-500">
            Your recipes live here. Changing it signs you out of this device.
          </p>
          <button type="button" className="btn-secondary" onClick={() => setChangingServer(true)}>
            Change server
          </button>
        </section>
      ) : null}

      <section className="card space-y-2 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Your data
        </h2>
        <p className="text-sm text-neutral-700">
          Recipes, collections, shopping list and cooking progress are private to your account and are checked on the server for every
          request.
        </p>
      </section>

      <button
        type="button"
        className="btn-danger w-full"
        onClick={async () => {
          await logout();
          navigate('/sign-in', { replace: true });
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
