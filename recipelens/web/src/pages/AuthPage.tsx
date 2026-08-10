import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/AppShell.js';
import { InlineError } from '../components/feedback.js';
import { ApiError } from '../lib/api.js';
import { useAuth } from '../state/AuthContext.js';

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

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (password.length < 8) errors.password = 'Use at least 8 characters.';
    if (signingUp && displayName.trim().length === 0) errors.displayName = 'Tell us what to call you.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setPending(true);
    try {
      if (signingUp) await register(email.trim(), password, displayName.trim());
      else await login(email.trim(), password);
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
