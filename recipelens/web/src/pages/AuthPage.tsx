import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/AppShell.js';
import { InlineError } from '../components/feedback.js';
import { api, ApiError } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { GoogleSignInButton } from '../components/GoogleSignIn.js';
import { useAuth } from '../state/AuthContext.js';
import { describeEmailProblem, normalizeEmail } from '../shared.js';

interface FieldErrors {
  email?: string;
  password?: string;
  displayName?: string;
}

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const signingUp = mode === 'sign-up';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Google is offered only when the server can actually verify its tokens.
  const health = useAsync(() => api.health(), []);

  function validate(values: { email: string; password: string; displayName: string }): boolean {
    const errors: FieldErrors = {};
    // Says what is wrong, not just that something is — the usual culprits here
    // are invisible or come from autocorrect, so "invalid" is no help at all.
    errors.email = describeEmailProblem(values.email) ?? undefined;
    if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
    if (signingUp && values.displayName.trim().length === 0) errors.displayName = 'Tell us what to call you.';
    const present = Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
    setFieldErrors(present);
    return Object.keys(present).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Read the fields themselves rather than trusting React's copy. Android
    // autofill and some password managers assign input.value directly, which
    // leaves the controlled state empty — the form then rejects an address that
    // is plainly visible on screen, on both sign-in and sign-up.
    const form = new FormData(event.currentTarget);
    const read = (name: string, fallback: string) => {
      const value = form.get(name);
      return typeof value === 'string' && value ? value : fallback;
    };

    const values = {
      email: normalizeEmail(read('email', email)),
      password: read('password', password),
      displayName: read('displayName', displayName),
    };
    // Show the cleaned address, so what was sent is what is on screen.
    if (values.email !== email) setEmail(values.email);
    if (values.password !== password) setPassword(values.password);
    if (values.displayName !== displayName) setDisplayName(values.displayName);

    if (!validate(values)) return;

    setPending(true);
    try {
      if (signingUp) await register(values.email, values.password, values.displayName.trim());
      else await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/sign-in' ? from : '/', { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <BrandMark />
        <p className="mt-3 text-sm text-neutral-600">
          Turn cooking videos, links and screenshots into recipes you can actually cook from.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-5" noValidate>
        <h1 className="text-xl font-bold">{signingUp ? 'Create your account' : 'Welcome back'}</h1>

        {signingUp ? (
          <div>
            <label className="label" htmlFor="displayName">
              Name
            </label>
            <input
              id="displayName"
              name="displayName"
              className="field"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.displayName)}
            />
            <InlineError message={fieldErrors.displayName ?? null} />
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            className="field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.email)}
          />
          <InlineError message={fieldErrors.email ?? null} />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="field"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          <InlineError message={fieldErrors.password ?? null} />
        </div>

        {formError ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'}
        </button>

        {health.data?.google?.configured ? (
          <>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <span className="h-px flex-1 bg-neutral-200" />
              or
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
            <GoogleSignInButton
              onError={(message) => setFormError(message)}
              onSignedIn={() => {
                const from = (location.state as { from?: string } | null)?.from;
                navigate(from && from !== '/sign-in' ? from : '/', { replace: true });
              }}
            />
          </>
        ) : null}

        <p className="text-center text-sm text-neutral-600">
          {signingUp ? (
            <>
              Already have an account?{' '}
              <Link className="font-semibold text-brand-600" to="/sign-in">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to RecipeLens?{' '}
              <Link className="font-semibold text-brand-600" to="/sign-up">
                Create an account
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
