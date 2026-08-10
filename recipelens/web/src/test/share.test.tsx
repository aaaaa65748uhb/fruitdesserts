/**
 * "Share to RecipeLens" wiring.
 *
 * The Android side (MainActivity + SharedIntentPlugin) hands a payload to
 * `runtime.consumePendingShare()` / `onShare()`. These tests stub that boundary
 * and prove the rest of the journey: the app routes to the import screen, fills
 * the link in, and starts the analysis without another tap.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyze = vi.fn();
const capabilities = vi.fn();
const progress = vi.fn();
let pendingShare: { type: 'url' | 'text'; value: string } | null = null;
let shareHandler: ((item: { type: 'url' | 'text'; value: string }) => void) | null = null;

vi.mock('../lib/runtime.js', () => ({
  isNative: true,
  platform: 'android',
  apiBaseUrl: () => 'https://api.example.test',
  nativeConfigError: () => null,
  tokenStore: { get: async () => null, set: async () => undefined },
  consumePendingShare: async () => pendingShare,
  onShare: async (handler: (item: { type: 'url' | 'text'; value: string }) => void) => {
    shareHandler = handler;
    return () => {
      shareHandler = null;
    };
  },
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/api.js')>('../lib/api.js');
  return {
    ...actual,
    api: { import: { analyze, capabilities, progress } },
  };
});

const { ImportPage } = await import('../pages/ImportPage.js');
const { ShareProvider } = await import('../state/ShareContext.js');

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ShareProvider>
        <Routes>
          <Route path="/" element={<p>home</p>} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </ShareProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  pendingShare = null;
  shareHandler = null;
  capabilities.mockResolvedValue({
    ai: { configured: true, provider: 'test', model: 'test', reason: null },
    sources: { url: true, text: true, image: true, video: true },
    limits: { maxUploadBytes: 8_000_000, maxImages: 4 },
    notes: [],
  });
  progress.mockResolvedValue({ known: true, phases: [{ phase: 'analysing', label: 'Understanding the recipe' }], finished: false, error: null });
  analyze.mockResolvedValue({
    recipe: { id: 'r1', title: 'Creamy Garlic Pasta' },
    analysis: { id: 'a1', source: 'ai', provider: 'test', model: 'test', attempts: 1, durationMs: 900, cached: false },
    warnings: [],
  });
});

describe('Android share target', () => {
  it('a TikTok link shared on cold start lands on Import and analyses itself', async () => {
    pendingShare = { type: 'url', value: 'https://www.tiktok.com/@chef/video/123' };
    renderApp();

    expect(await screen.findByRole('heading', { name: /turn any cooking video into a recipe/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/recipe or video link/i)).toHaveValue('https://www.tiktok.com/@chef/video/123'));
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    expect(analyze.mock.calls[0][0]).toEqual({ type: 'url', url: 'https://www.tiktok.com/@chef/video/123' });
    expect(await screen.findByRole('button', { name: /open recipe/i })).toBeInTheDocument();
  });

  it('an Instagram link shared while the app is open is picked up too', async () => {
    renderApp();
    await waitFor(() => expect(shareHandler).not.toBeNull());

    shareHandler!({ type: 'url', value: 'https://www.instagram.com/reel/abc/' });

    await waitFor(() => expect(screen.getByLabelText(/recipe or video link/i)).toHaveValue('https://www.instagram.com/reel/abc/'));
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
  });

  it('shared plain text goes to the text tab instead of the link tab', async () => {
    pendingShare = { type: 'text', value: '200 g spaghetti, 3 cloves garlic, cream. Boil, fry, toss. Serves 2.' };
    renderApp();

    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    expect(analyze.mock.calls[0][0].type).toBe('text');
    expect(analyze.mock.calls[0][0].text).toContain('spaghetti');
  });

  it('one share never becomes two imports, even if Android re-delivers it', async () => {
    pendingShare = { type: 'url', value: 'https://www.tiktok.com/@chef/video/999' };
    renderApp();
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));

    // The same intent arriving again immediately is ignored.
    shareHandler?.({ type: 'url', value: 'https://www.tiktok.com/@chef/video/999' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('sends a request id so the screen can show real server progress', async () => {
    pendingShare = { type: 'url', value: 'https://youtube.com/shorts/xyz' };
    renderApp();

    await waitFor(() => expect(analyze).toHaveBeenCalled());
    const requestId = analyze.mock.calls[0][2];
    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(8);
  });
});
