import { AlertTriangle, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ApiError } from '../lib/api.js';

export function Spinner({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm text-neutral-500 ${className}`} role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </span>
  );
}

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card h-24 animate-pulse bg-neutral-100" />
      ))}
    </div>
  );
}

/**
 * Error surface used by every screen: a readable message, the server's
 * suggested next steps, and a retry when retrying can actually help.
 */
export function ErrorState({
  error,
  onRetry,
  actions,
}: {
  error: ApiError;
  onRetry?: () => void;
  actions?: ReactNode;
}) {
  const offline = error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT';
  return (
    <div className="card animate-fade-in border-red-200 bg-red-50/60 p-4" role="alert">
      <div className="flex items-start gap-3">
        {offline ? (
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-red-900">{error.message}</p>
          {error.recovery?.length ? (
            <ul className="mt-2 list-inside list-disc text-sm text-red-800">
              {error.recovery.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <ProviderReason details={error.details} />
          {(onRetry && error.retryable) || actions ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {onRetry && error.retryable ? (
                <button type="button" className="btn-secondary" onClick={onRetry}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
              ) : null}
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface ProviderDetails {
  provider?: string;
  model?: string;
  endpoint?: string;
  providerStatus?: number | null;
  providerSaid?: string;
}

/**
 * What the model's own endpoint said, when it said anything. This is the
 * difference between "something went wrong" and "that model is not available
 * to this key" — and it is the only clue the person in front of the screen
 * can act on or pass along. Redacted server-side before it is ever sent.
 */
function ProviderReason({ details }: { details: unknown }) {
  const info = details as ProviderDetails | null;
  if (!info?.providerSaid && !info?.providerStatus) return null;
  return (
    <details className="mt-3 text-sm text-red-900">
      <summary className="cursor-pointer font-medium">What the AI provider said</summary>
      <p className="mt-1 text-red-800">
        {info.provider ?? 'provider'}
        {info.model ? ` · ${info.model}` : ''}
        {info.endpoint ? ` · ${info.endpoint}` : ''}
      </p>
      <p className="mt-1 break-all rounded bg-white/70 p-2 font-mono text-xs">
        {info.providerStatus ? `HTTP ${info.providerStatus} — ` : ''}
        {info.providerSaid || 'no message'}
      </p>
    </details>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        <p className="mt-1 text-sm text-neutral-600">{description}</p>
      </div>
      {action}
    </div>
  );
}
