import { ArrowLeft, ArrowRight, Check, Pause, Play, RotateCcw, Timer as TimerIcon, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorState, LoadingScreen } from '../components/feedback.js';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { scaleRecipe } from '../shared.js';

/** Local mirror of the server session so a refresh never loses a step. */
const storageKey = (recipeId: string) => `recipelens:cooking:${recipeId}`;

interface LocalProgress {
  currentStep: number;
  completedSteps: number[];
  servings: number | null;
}

function readLocal(recipeId: string): LocalProgress | null {
  try {
    const raw = localStorage.getItem(storageKey(recipeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalProgress;
    if (typeof parsed?.currentStep !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(recipeId: string, progress: LocalProgress): void {
  try {
    localStorage.setItem(storageKey(recipeId), JSON.stringify(progress));
  } catch {
    // Storage can be full or blocked; the server copy is the source of truth.
  }
}

export function CookPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const state = useAsync(async () => {
    const [recipe, session] = await Promise.all([api.recipes.get(id), api.cooking.get(id)]);
    return { recipe: recipe.recipe, session: session.session };
  }, [id]);

  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [servings, setServings] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recipe = state.data?.recipe ?? null;

  useEffect(() => {
    if (!state.data || restored) return;
    const local = readLocal(id);
    const session = state.data.session;
    // Prefer whichever source is further along — the cook never loses progress.
    const source =
      local && session
        ? local.currentStep >= session.currentStep
          ? local
          : { currentStep: session.currentStep, completedSteps: session.completedSteps, servings: session.servings }
        : local ?? (session ? { currentStep: session.currentStep, completedSteps: session.completedSteps, servings: session.servings } : null);

    if (source) {
      setCurrentStep(Math.min(source.currentStep, Math.max(state.data.recipe.steps.length - 1, 0)));
      setCompleted(source.completedSteps.filter((index) => index < state.data!.recipe.steps.length));
      setServings(source.servings ?? state.data.recipe.servings ?? null);
    } else {
      setServings(state.data.recipe.servings ?? null);
    }
    setRestored(true);
  }, [state.data, id, restored]);

  const persist = useCallback(
    (next: LocalProgress, completedRun = false) => {
      writeLocal(id, next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Debounced so tapping through steps quickly is one write, not five.
      saveTimer.current = setTimeout(() => {
        void api.cooking
          .save(id, { currentStep: next.currentStep, completedSteps: next.completedSteps, servings: next.servings, completed: completedRun })
          .catch(() => {
            /* Offline is fine: localStorage keeps the progress until we sync. */
          });
      }, 400);
    },
    [id],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const scaled = useMemo(() => (recipe ? scaleRecipe(recipe, servings ?? recipe.servings ?? null) : null), [recipe, servings]);

  if (state.initializing) return <LoadingScreen label="Getting things ready…" />;
  if (state.error) return <ErrorState error={state.error} onRetry={() => void state.reload()} />;
  if (!recipe || !scaled) return null;

  const steps = recipe.steps;
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const progress = steps.length ? (completed.length / steps.length) * 100 : 0;

  function goTo(index: number) {
    const next = Math.max(0, Math.min(index, steps.length - 1));
    setCurrentStep(next);
    persist({ currentStep: next, completedSteps: completed, servings });
  }

  function toggleComplete(index: number) {
    const next = completed.includes(index) ? completed.filter((i) => i !== index) : [...completed, index].sort((a, b) => a - b);
    setCompleted(next);
    persist({ currentStep, completedSteps: next, servings }, next.length === steps.length);
  }

  function completeAndAdvance() {
    const next = completed.includes(currentStep) ? completed : [...completed, currentStep].sort((a, b) => a - b);
    const nextStep = Math.min(currentStep + 1, steps.length - 1);
    setCompleted(next);
    setCurrentStep(nextStep);
    persist({ currentStep: nextStep, completedSteps: next, servings }, next.length === steps.length);
  }

  async function finish() {
    const all = steps.map((_, index) => index);
    setCompleted(all);
    persist({ currentStep, completedSteps: all, servings }, true);
    try {
      localStorage.removeItem(storageKey(id));
    } catch {
      /* ignore */
    }
    navigate(`/recipes/${id}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col">
      <header className="flex items-center justify-between gap-2 pb-3">
        <Link className="btn-ghost px-2" to={`/recipes/${id}`} aria-label="Leave cooking mode">
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold">{recipe.title}</p>
          <p className="text-xs text-neutral-500">
            Step {currentStep + 1} of {steps.length}
            {servings ? ` · ${servings} servings` : ''}
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost px-2"
          aria-label="Restart progress"
          onClick={() => {
            setCompleted([]);
            setCurrentStep(0);
            persist({ currentStep: 0, completedSteps: [], servings });
          }}
        >
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="h-2 overflow-hidden rounded-full bg-neutral-200" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="card mt-4 flex-1 p-5">
        <p className="text-lg leading-relaxed text-neutral-900">{step?.instruction}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-neutral-600">
          {step?.temperatureC != null ? <span className="badge bg-neutral-100">{step.temperatureC}°C</span> : null}
          {step?.estimated ? <span className="badge bg-amber-100 text-amber-800">AI estimate</span> : null}
        </div>

        {step?.durationSeconds ? <StepTimer key={`${id}-${currentStep}`} seconds={step.durationSeconds} /> : null}

        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">Ingredients for this cook</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {scaled.ingredients.map((ingredient, index) => (
              <li key={ingredient.id ?? index} className="flex justify-between gap-3 border-b border-neutral-100 py-1 last:border-0">
                <span>{ingredient.name}</span>
                <span className="font-medium tabular-nums">{ingredient.displayText || '—'}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" className="btn-secondary" onClick={() => goTo(currentStep - 1)} disabled={currentStep === 0}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
        <button
          type="button"
          className={completed.includes(currentStep) ? 'btn-primary' : 'btn-secondary'}
          aria-pressed={completed.includes(currentStep)}
          onClick={() => toggleComplete(currentStep)}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Done
        </button>
        {isLast ? (
          <button type="button" className="btn-primary" onClick={() => void finish()}>
            Finish
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={completeAndAdvance}>
            Next
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <ol className="mt-4 flex flex-wrap gap-2 pb-4">
        {steps.map((_, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to step ${index + 1}${completed.includes(index) ? ' (done)' : ''}`}
              aria-current={index === currentStep ? 'step' : undefined}
              className={`h-8 w-8 rounded-full text-xs font-bold transition ${
                index === currentStep
                  ? 'bg-brand-500 text-white'
                  : completed.includes(index)
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-neutral-200 text-neutral-600'
              }`}
            >
              {index + 1}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setRunning(false);
          setDone(true);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="mt-5 flex items-center gap-3 rounded-xl bg-neutral-100 p-3">
      <TimerIcon className={`h-5 w-5 ${done ? 'text-emerald-600' : 'text-neutral-500'}`} aria-hidden="true" />
      <span className="text-2xl font-bold tabular-nums" aria-live={done ? 'assertive' : 'off'}>
        {minutes}:{String(secs).padStart(2, '0')}
      </span>
      {done ? <span className="text-sm font-semibold text-emerald-700">Time&apos;s up</span> : null}
      <div className="ml-auto flex gap-2">
        <button type="button" className="btn-secondary min-h-[36px] px-3" onClick={() => setRunning((value) => !value)} disabled={remaining === 0}>
          {running ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          type="button"
          className="btn-ghost min-h-[36px] px-3"
          onClick={() => {
            setRunning(false);
            setDone(false);
            setRemaining(seconds);
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
