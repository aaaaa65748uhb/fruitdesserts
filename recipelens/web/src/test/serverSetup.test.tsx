/**
 * First-run server setup on Android: one APK, any backend.
 * The address is verified against /api/health before it is stored.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted so the module factory below can close over them.
const { setApiBaseUrl, checkServer } = vi.hoisted(() => ({ setApiBaseUrl: vi.fn(), checkServer: vi.fn() }));

vi.mock('../lib/runtime.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/runtime.js')>('../lib/runtime.js');
  return { ...actual, isNative: true, setApiBaseUrl, checkServer };
});

const { ServerSetup } = await import('../components/ServerSetup.js');
// Spread from the real module, so this is the genuine implementation.
const { normalizeBaseUrl } = await import('../lib/runtime.js');

beforeEach(() => {
  vi.clearAllMocks();
  setApiBaseUrl.mockResolvedValue(undefined);
});

describe('address tidying', () => {
  it('accepts what a person actually types', () => {
    expect(normalizeBaseUrl('recipelens.onrender.com')).toBe('https://recipelens.onrender.com');
    expect(normalizeBaseUrl('  https://recipelens.onrender.com/  ')).toBe('https://recipelens.onrender.com');
    expect(normalizeBaseUrl('https://recipelens.onrender.com/api')).toBe('https://recipelens.onrender.com');
    expect(normalizeBaseUrl('http://192.168.1.10:4000')).toBe('http://192.168.1.10:4000');
  });

  it('rejects nonsense', () => {
    expect(normalizeBaseUrl('')).toBeNull();
    expect(normalizeBaseUrl('not a url')).toBeNull();
    expect(normalizeBaseUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('ServerSetup', () => {
  it('stores an address that answers as a RecipeLens server', async () => {
    const user = userEvent.setup();
    const onConnected = vi.fn();
    checkServer.mockResolvedValue({
      ok: true,
      baseUrl: 'https://recipelens.onrender.com',
      aiConfigured: true,
      aiProvider: 'nvidia',
    });

    render(<ServerSetup onConnected={onConnected} />);
    await user.type(screen.getByLabelText('Address'), 'recipelens.onrender.com');
    await user.click(screen.getByRole('button', { name: /connect/i }));

    await waitFor(() => expect(setApiBaseUrl).toHaveBeenCalledWith('https://recipelens.onrender.com'));
    expect(onConnected).toHaveBeenCalled();
  });

  it('refuses to store an address that cannot be reached', async () => {
    const user = userEvent.setup();
    const onConnected = vi.fn();
    checkServer.mockResolvedValue({ ok: false, baseUrl: 'https://nope.example', message: 'Could not reach that address.' });

    render(<ServerSetup onConnected={onConnected} />);
    await user.type(screen.getByLabelText('Address'), 'nope.example');
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(await screen.findByText(/could not reach that address/i)).toBeInTheDocument();
    expect(setApiBaseUrl).not.toHaveBeenCalled();
    expect(onConnected).not.toHaveBeenCalled();
  });

  it('says so when the server has no AI configured yet', async () => {
    const user = userEvent.setup();
    checkServer.mockResolvedValue({ ok: true, baseUrl: 'https://recipelens.onrender.com', aiConfigured: false });

    render(<ServerSetup onConnected={vi.fn()} />);
    await user.type(screen.getByLabelText('Address'), 'recipelens.onrender.com');
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(await screen.findByText(/AI not configured on that server yet/i)).toBeInTheDocument();
  });
});
