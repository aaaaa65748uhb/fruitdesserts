/**
 * The AI connection check in Settings.
 *
 * This is the screen someone opens after an import failed, so its whole job is
 * to show what the provider objected to — a green tick that hides a 404 would
 * be worse than no check at all.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const health = vi.fn();
const diagnosticsAi = vi.fn();

vi.mock('../state/AuthContext.js', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'cook@example.test', displayName: 'Cook' },
    loading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
  }),
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/api.js')>('../lib/api.js');
  return { ...actual, api: { health, diagnostics: { ai: diagnosticsAi }, auth: { updateProfile: vi.fn() } } };
});

const { SettingsPage } = await import('../pages/SettingsPage.js');

const BASE = {
  provider: 'nvidia',
  configuredModel: 'meta/llama-4-maverick-17b-128e-instruct',
  endpoint: 'integrate.api.nvidia.com',
  checkedAt: '2026-08-12T10:00:00.000Z',
  recentFailures: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  health.mockResolvedValue({
    status: 'ok',
    database: 'ok',
    ai: { configured: true, provider: 'nvidia', model: 'meta/llama-4-maverick-17b-128e-instruct' },
  });
});

function open() {
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('Test AI connection', () => {
  it('confirms a working model and what it extracted', async () => {
    const user = userEvent.setup();
    diagnosticsAi.mockResolvedValue({
      ...BASE,
      ok: true,
      check: 'deep',
      model: 'meta/llama-4-maverick-17b-128e-instruct',
      latencyMs: 2400,
      extracted: { title: 'Garlic butter', ingredientCount: 2, stepCount: 2 },
    });

    open();
    await user.click(await screen.findByRole('button', { name: /test ai connection/i }));

    expect(await screen.findByText(/the model answered correctly/i)).toBeInTheDocument();
    expect(screen.getByText(/2 ingredients, 2 steps/i)).toBeInTheDocument();
    // The deep check is the one that matches a real import.
    expect(diagnosticsAi).toHaveBeenCalledWith(true);
  });

  it('shows what the provider actually said when the check fails', async () => {
    const user = userEvent.setup();
    diagnosticsAi.mockResolvedValue({
      ...BASE,
      ok: false,
      check: 'deep',
      failure: { code: 'AI_INVALID_RESPONSE', message: 'The AI provider returned an unusable response.', status: 502 },
      recentFailures: [
        {
          at: '2026-08-12T10:00:00.000Z',
          stage: 'http',
          status: 404,
          detail: '{"message":"model not found"}',
        },
      ],
    });

    open();
    await user.click(await screen.findByRole('button', { name: /test ai connection/i }));

    expect(await screen.findByText(/did not answer usably/i)).toBeInTheDocument();
    expect(screen.getByText(/HTTP 404/)).toBeInTheDocument();
    expect(screen.getByText(/model not found/)).toBeInTheDocument();
  });

  it('reports a check that could not be run at all', async () => {
    const user = userEvent.setup();
    diagnosticsAi.mockRejectedValue(new Error('Could not reach RecipeLens.'));

    open();
    await user.click(await screen.findByRole('button', { name: /test ai connection/i }));

    expect(await screen.findByText(/could not reach recipelens/i)).toBeInTheDocument();
  });
});

describe('a failed import on screen', () => {
  it('shows what the provider said, so the reason is not lost', async () => {
    const { ErrorState } = await import('../components/feedback.js');
    const { ApiError } = await import('../lib/api.js');
    const user = userEvent.setup();

    render(
      <ErrorState
        error={
          new ApiError(502, 'AI_INVALID_RESPONSE', 'The AI provider returned an unusable response.', {
            details: {
              provider: 'nvidia',
              model: 'meta/llama-4-maverick-17b-128e-instruct',
              endpoint: 'integrate.api.nvidia.com',
              providerStatus: 404,
              providerSaid: '{"message":"model not found"}',
            },
          })
        }
      />,
    );

    await user.click(screen.getByText(/what the ai provider said/i));
    expect(screen.getByText(/HTTP 404/)).toBeInTheDocument();
    expect(screen.getByText(/model not found/)).toBeInTheDocument();
    expect(screen.getByText(/integrate\.api\.nvidia\.com/)).toBeInTheDocument();
  });

  it('stays quiet when there is nothing extra to say', async () => {
    const { ErrorState } = await import('../components/feedback.js');
    const { ApiError } = await import('../lib/api.js');
    render(<ErrorState error={new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong.')} />);
    expect(screen.queryByText(/what the ai provider said/i)).not.toBeInTheDocument();
  });
});
