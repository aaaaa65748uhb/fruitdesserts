import { Camera, Check, FileText, Link2, Loader2, Sparkles, Video, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/AppShell.js';
import { ErrorState, InlineError } from '../components/feedback.js';
import { api, ApiError, type ImportCapabilities, type ImportResult } from '../lib/api.js';
import { isNative } from '../lib/runtime.js';
import { useAsync } from '../lib/useAsync.js';
import { useShare } from '../state/ShareContext.js';

type Tab = 'url' | 'text' | 'image' | 'video';

const TABS: Array<{ id: Tab; label: string; icon: typeof Link2 }> = [
  { id: 'url', label: 'Link', icon: Link2 },
  { id: 'text', label: 'Text', icon: FileText },
  { id: 'image', label: 'Screenshot', icon: Camera },
  { id: 'video', label: 'Video', icon: Video },
];

/** Shown before the server has reported its first phase. */
const INITIAL_PHASE = { phase: 'received', label: 'Sending the source to RecipeLens' };

export function ImportPage() {
  const navigate = useNavigate();
  const capabilities = useAsync<ImportCapabilities>(() => api.import.capabilities(), []);

  const [tab, setTab] = useState<Tab>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [videoInfo, setVideoInfo] = useState<{ filename: string; sizeBytes: number; durationSeconds?: number } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState(false);
  const [phases, setPhases] = useState<Array<{ phase: string; label: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);

  const { pending: sharedItem, consume } = useShare();
  const [autoRun, setAutoRun] = useState(false);
  const importRef = useRef<() => Promise<void>>(async () => undefined);

  // A link shared from TikTok/Instagram/YouTube lands here already filled in.
  useEffect(() => {
    if (!sharedItem) return;
    const item = consume();
    if (!item) return;
    setError(null);
    setResult(null);
    if (item.type === 'url') {
      setTab('url');
      setUrl(item.value);
    } else {
      setTab('text');
      setText(item.value);
    }
    setAutoRun(true);
  }, [sharedItem, consume]);

  // Share -> analyse with no extra taps.
  useEffect(() => {
    if (!autoRun) return;
    setAutoRun(false);
    void importRef.current();
  }, [autoRun]);

  // Progress comes from the server: each entry is a phase it actually reached.
  const [requestId, setRequestId] = useState<string | null>(null);
  useEffect(() => {
    if (!pending || !requestId) return undefined;
    let cancelled = false;
    const poll = setInterval(async () => {
      try {
        const status = await api.import.progress(requestId);
        if (!cancelled && status.known) setPhases(status.phases.map(({ phase, label }) => ({ phase, label })));
      } catch {
        // Progress is a nicety; the import itself reports success or failure.
      }
    }, 900);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [pending, requestId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const maxBytes = capabilities.data?.limits.maxUploadBytes ?? 8 * 1024 * 1024;
  const maxImages = capabilities.data?.limits.maxImages ?? 4;
  const aiConfigured = capabilities.data?.ai.configured ?? false;

  async function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.readAsDataURL(file);
    });
  }

  async function onPickImages(files: FileList | null) {
    setFieldError(null);
    if (!files?.length) return;
    const accepted: string[] = [];
    for (const file of Array.from(files).slice(0, maxImages - images.length)) {
      if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
        setFieldError('Only PNG, JPEG and WebP images are supported.');
        continue;
      }
      if (file.size > maxBytes) {
        setFieldError(`“${file.name}” is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
        continue;
      }
      accepted.push(await readFile(file));
    }
    if (accepted.length) setImages((current) => [...current, ...accepted].slice(0, maxImages));
  }

  function onPickVideo(files: FileList | null) {
    setFieldError(null);
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setFieldError('Choose a video file.');
      return;
    }
    setVideoInfo({ filename: file.name, sizeBytes: file.size });
  }

  function validate(): boolean {
    setFieldError(null);
    if (tab === 'url') {
      const trimmed = url.trim();
      if (!trimmed) {
        setFieldError('Paste a link to import.');
        return false;
      }
      if (!/^https?:\/\/\S+\.\S+/i.test(trimmed)) {
        setFieldError('That does not look like a link. It should start with http:// or https://');
        return false;
      }
      return true;
    }
    if (tab === 'text') {
      if (text.trim().length < 20) {
        setFieldError('Paste a bit more of the recipe (at least 20 characters).');
        return false;
      }
      return true;
    }
    if (tab === 'image') {
      if (images.length === 0) {
        setFieldError('Add at least one screenshot.');
        return false;
      }
      return true;
    }
    if (!caption.trim() && images.length === 0) {
      setFieldError('Add the video caption or a screenshot — the audio cannot be read automatically.');
      return false;
    }
    return true;
  }

  async function onImport() {
    if (!validate()) return;
    setError(null);
    setResult(null);
    setPhases([INITIAL_PHASE]);
    setPending(true);
    const id = crypto.randomUUID().replace(/-/g, '');
    setRequestId(id);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload =
        tab === 'url'
          ? ({ type: 'url', url: url.trim() } as const)
          : tab === 'text'
            ? ({ type: 'text', text: text.trim() } as const)
            : tab === 'image'
              ? ({ type: 'image', images, ocrText: note.trim() || undefined } as const)
              : ({
                  type: 'video',
                  filename: videoInfo?.filename,
                  sizeBytes: videoInfo?.sizeBytes,
                  captions: caption.trim() ? [caption.trim()] : undefined,
                  frames: images.length ? images : undefined,
                } as const);

      const response = await api.import.analyze(payload, controller.signal, id);
      setResult(response);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'UNKNOWN', 'Import failed. Please try again.'));
    } finally {
      setPending(false);
      abortRef.current = null;
    }
  }

  importRef.current = onImport;

  return (
    <div className="space-y-4">
      <PageHeader title="Turn any cooking video into a recipe" subtitle="Share from TikTok, Instagram or YouTube — or paste a link, a screenshot or the text." />

      {capabilities.data && !aiConfigured ? (
        <div className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <p className="font-medium">AI analysis is turned off on this server.</p>
          <p className="mt-1">{capabilities.data.ai.reason}</p>
          <p className="mt-1">Links that publish a machine-readable recipe still import, and you can always add a recipe by hand.</p>
        </div>
      ) : null}

      <div className="card border-brand-200 bg-brand-50/60 p-3 text-sm text-brand-900">
        <p className="font-semibold">Share a video</p>
        <p className="mt-1">
          {isNative
            ? 'In TikTok, Instagram or YouTube tap Share → RecipeLens. The link lands here and analysis starts on its own.'
            : 'On the Android app you can tap Share → RecipeLens straight from TikTok, Instagram or YouTube. Here in the browser, paste the link below.'}
        </p>
      </div>

      <div role="tablist" aria-label="Import source" className="grid grid-cols-4 gap-1 rounded-xl bg-neutral-100 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium transition ${
              tab === item.id ? 'bg-white text-brand-600 shadow-sm' : 'text-neutral-600'
            }`}
            onClick={() => {
              setTab(item.id);
              setFieldError(null);
              setError(null);
            }}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="card p-4">
        {tab === 'url' ? (
          <div>
            <label className="label" htmlFor="import-url">
              Recipe or video link
            </label>
            <input
              id="import-url"
              className="field"
              inputMode="url"
              placeholder="https://www.tiktok.com/@chef/video/…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <p className="mt-2 text-xs text-neutral-500">
              Works with recipe sites, YouTube, TikTok and Instagram links. Social platforms do not expose video audio to third
              parties, so captions and on-screen text are used.
            </p>
          </div>
        ) : null}

        {tab === 'text' ? (
          <div>
            <label className="label" htmlFor="import-text">
              Paste the recipe
            </label>
            <textarea
              id="import-text"
              className="field min-h-[180px]"
              placeholder="Ingredients, then the method — exactly as you have it."
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <p className="mt-1 text-xs text-neutral-500">{text.trim().length} characters</p>
          </div>
        ) : null}

        {tab === 'image' || tab === 'video' ? (
          <div className="space-y-3">
            {tab === 'video' ? (
              <div>
                <label className="label" htmlFor="import-video">
                  Video file (optional)
                </label>
                <input id="import-video" type="file" accept="video/*" className="field py-2" onChange={(event) => onPickVideo(event.target.files)} />
                {videoInfo ? (
                  <p className="mt-1 text-xs text-neutral-500">
                    {videoInfo.filename} · {(videoInfo.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                ) : null}
                <label className="label mt-3" htmlFor="import-caption">
                  Caption or spoken steps
                </label>
                <textarea
                  id="import-caption"
                  className="field min-h-[100px]"
                  placeholder="Paste the caption, or type what the video says."
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                />
              </div>
            ) : null}

            <div>
              <label className="label" htmlFor="import-images">
                {tab === 'video' ? 'Frames from the video' : 'Screenshots'} (up to {maxImages})
              </label>
              <input
                id="import-images"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="field py-2"
                onChange={(event) => void onPickImages(event.target.files)}
                disabled={images.length >= maxImages}
              />
              {images.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {images.map((image, index) => (
                    <li key={index} className="relative">
                      <img src={image} alt={`Selected ${index + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                      <button
                        type="button"
                        className="absolute -right-2 -top-2 rounded-full bg-neutral-900/80 p-1 text-white"
                        aria-label={`Remove image ${index + 1}`}
                        onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {tab === 'image' ? (
              <div>
                <label className="label" htmlFor="import-note">
                  Anything the screenshot does not show (optional)
                </label>
                <textarea
                  id="import-note"
                  className="field min-h-[80px]"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <InlineError message={fieldError} />

        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="btn-primary flex-1" onClick={() => void onImport()} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            {pending ? 'Analysing…' : 'Analyze Recipe'}
          </button>
          {pending ? (
            <button type="button" className="btn-secondary" onClick={() => abortRef.current?.abort()}>
              Cancel
            </button>
          ) : null}
        </div>

        {pending ? (
          <div className="mt-3" aria-live="polite">
            <p className="text-sm font-medium text-neutral-800">Analyzing your recipe…</p>
            <ul className="mt-2 space-y-1 text-sm">
              {phases.map((entry, index) => (
                <li key={`${entry.phase}-${index}`} className="flex items-center gap-2 text-neutral-700">
                  {index === phases.length - 1 ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" aria-hidden="true" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  )}
                  {entry.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => void onImport()}
          actions={
            <>
              <button type="button" className="btn-secondary" onClick={() => setTab('text')}>
                Paste the recipe text
              </button>
              <button type="button" className="btn-secondary" onClick={() => setTab('image')}>
                Upload a screenshot
              </button>
            </>
          }
        />
      ) : null}

      {result ? (
        <div className="card animate-fade-in space-y-3 p-4" aria-live="polite">
          <div>
            <h2 className="text-lg font-semibold">{result.recipe.title}</h2>
            <p className="text-sm text-neutral-600">
              {result.analysis.source === 'structured-data'
                ? 'Imported directly from the page’s structured recipe data.'
                : result.analysis.cached
                  ? 'Reused a recent analysis of the same source.'
                  : `Analysed by ${result.analysis.provider} (${result.analysis.model}) in ${(result.analysis.durationMs / 1000).toFixed(1)}s.`}
            </p>
          </div>

          {result.warnings.length ? (
            <ul className="list-inside list-disc rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => navigate(`/recipes/${result.recipe.id}`)}>
              Open recipe
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate(`/recipes/${result.recipe.id}/edit`)}>
              Review and edit
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
