/**
 * Assistant panels: nutrition, substitutions, AI customisation and recipe Q&A.
 * Every one of them labels its output as an AI estimate.
 */
import { Flame, MessageCircle, Repeat, Send, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError, type Recipe } from '../lib/api.js';
import { ErrorState, Spinner } from './feedback.js';
import { Modal } from './Modal.js';
import { CUSTOMIZATION_GOALS, GOAL_LABELS, formatMeasure, type ChatAnswer, type Customization, type CustomizationGoal, type Ingredient, type Nutrition, type Substitution } from '../shared.js';

function useAiAction<T>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<T>) {
    setPending(true);
    setError(null);
    try {
      setData(await action());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'UNKNOWN', 'That did not work. Please try again.'));
    } finally {
      setPending(false);
    }
  }

  return { data, error, pending, run, setData };
}

/* -------------------------------------------------------------------------- */
/* Nutrition                                                                  */
/* -------------------------------------------------------------------------- */

const NUTRIENTS: Array<{ key: keyof Nutrition; label: string; unit: string }> = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
];

export function NutritionPanel({ recipe, servings }: { recipe: Recipe; servings: number | null }) {
  const state = useAiAction<{ nutrition: Nutrition; disclaimer: string }>();

  return (
    <section className="card p-4" aria-label="Nutrition">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Flame className="h-5 w-5 text-brand-500" aria-hidden="true" />
          Nutrition
        </h2>
        <button
          type="button"
          className="btn-secondary min-h-[36px] px-3 text-xs"
          disabled={state.pending}
          onClick={() => void state.run(() => api.assist.nutrition(recipe.id, servings ?? undefined))}
        >
          {state.pending ? <Spinner label="Estimating…" /> : state.data ? 'Re-estimate' : 'Estimate with AI'}
        </button>
      </div>

      {state.error ? (
        <div className="mt-3">
          <ErrorState error={state.error} onRetry={() => void state.run(() => api.assist.nutrition(recipe.id, servings ?? undefined))} />
        </div>
      ) : null}

      {state.data ? (
        <div className="mt-3">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {NUTRIENTS.map((nutrient) => {
              const value = state.data!.nutrition[nutrient.key] as number | null;
              return (
                <li key={nutrient.key} className="rounded-xl bg-neutral-50 p-2 text-center">
                  <p className="text-xs text-neutral-500">{nutrient.label}</p>
                  <p className="text-base font-semibold tabular-nums">
                    {value == null ? '—' : `${Math.round(value * 10) / 10}${nutrient.unit}`}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-neutral-600">
            {state.data.nutrition.basis === 'per-serving' ? 'Per serving' : 'For the whole recipe'} ·{' '}
            <span className="font-medium text-amber-800">{state.data.disclaimer}</span>
          </p>
          {state.data.nutrition.unaccounted.length ? (
            <p className="mt-1 text-xs text-neutral-600">
              Not counted (no amount given): {state.data.nutrition.unaccounted.join(', ')}.
            </p>
          ) : null}
        </div>
      ) : null}

      {!state.data && !state.pending && !state.error ? (
        <p className="mt-2 text-sm text-neutral-600">Nutrition is estimated by AI from the ingredient list, on request.</p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Substitutions                                                              */
/* -------------------------------------------------------------------------- */

export function SubstitutionDialog({
  recipe,
  ingredient,
  onClose,
}: {
  recipe: Recipe;
  ingredient: Ingredient | null;
  onClose: () => void;
}) {
  const state = useAiAction<{ ingredient: { id: string; name: string }; substitutions: Substitution[]; disclaimer: string }>();
  const [reason, setReason] = useState('');
  const [asked, setAsked] = useState(false);

  function ask() {
    if (!ingredient?.id) return;
    setAsked(true);
    void state.run(() => api.assist.substitutions(recipe.id, ingredient.id!, reason.trim() || undefined));
  }

  return (
    <Modal open={ingredient !== null} title={`Replace ${ingredient?.name ?? ''}`} onClose={onClose}>
      {!asked ? (
        <div className="space-y-3">
          <label className="label" htmlFor="sub-reason">
            Why are you replacing it? (optional)
          </label>
          <input
            id="sub-reason"
            className="field"
            placeholder="Out of stock, allergy, dietary…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button type="button" className="btn-primary w-full" onClick={ask}>
            <Repeat className="h-4 w-4" aria-hidden="true" />
            Suggest replacements
          </button>
        </div>
      ) : null}

      {state.pending ? <Spinner label="Thinking about this recipe…" /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={ask} /> : null}

      {state.data ? (
        <ul className="space-y-3">
          {state.data.substitutions.map((substitution, index) => (
            <li key={index} className="rounded-xl border border-neutral-200 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">{substitution.replacement}</p>
                <p className="text-sm font-medium tabular-nums text-neutral-700">
                  {formatMeasure(substitution.quantity, substitution.unit) || 'to taste'}
                </p>
              </div>
              <p className="mt-1 text-sm text-neutral-700">{substitution.why}</p>
              {substitution.changes ? <p className="mt-1 text-sm text-amber-800">What changes: {substitution.changes}</p> : null}
              {substitution.suitability != null ? (
                <p className="mt-1 text-xs text-neutral-500">Closeness to the original: {Math.round(substitution.suitability * 100)}%</p>
              ) : null}
            </li>
          ))}
          <li className="text-xs text-neutral-600">{state.data.disclaimer}</li>
        </ul>
      ) : null}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Customisation                                                              */
/* -------------------------------------------------------------------------- */

export function CustomizeDialog({
  recipe,
  open,
  onClose,
  onSaved,
}: {
  recipe: Recipe;
  open: boolean;
  onClose: () => void;
  onSaved: (recipeId: string) => void;
}) {
  const state = useAiAction<{ customization: Customization; recipe: Recipe | null; disclaimer: string }>();
  const [goals, setGoals] = useState<CustomizationGoal[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function toggle(goal: CustomizationGoal) {
    setGoals((current) => (current.includes(goal) ? current.filter((g) => g !== goal) : [...current, goal].slice(0, 4)));
  }

  return (
    <Modal open={open} title="Customize with AI" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-neutral-600">Pick up to four goals. The AI explains everything it changes.</p>
        <ul className="flex flex-wrap gap-2">
          {CUSTOMIZATION_GOALS.map((goal) => (
            <li key={goal}>
              <button
                type="button"
                aria-pressed={goals.includes(goal)}
                className={`min-h-[36px] rounded-full px-3 text-xs font-medium transition ${
                  goals.includes(goal) ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-700'
                }`}
                onClick={() => toggle(goal)}
              >
                {GOAL_LABELS[goal]}
              </button>
            </li>
          ))}
        </ul>

        <div>
          <label className="label" htmlFor="customize-notes">
            Anything else? (optional)
          </label>
          <input
            id="customize-notes"
            className="field"
            placeholder="No mushrooms, ready in 20 minutes…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn-primary w-full"
          disabled={goals.length === 0 || state.pending}
          onClick={() => void state.run(() => api.assist.customize(recipe.id, goals, { notes: notes.trim() || undefined }))}
        >
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          {state.pending ? 'Adapting…' : 'Adapt this recipe'}
        </button>

        {state.pending ? <Spinner label="Rewriting the recipe…" /> : null}
        {state.error ? <ErrorState error={state.error} onRetry={() => void state.run(() => api.assist.customize(recipe.id, goals))} /> : null}

        {state.data ? (
          <div className="space-y-3 rounded-xl border border-neutral-200 p-3">
            <h3 className="font-semibold">{state.data.customization.title}</h3>
            <div>
              <p className="text-sm font-medium text-neutral-800">What changed</p>
              <ul className="mt-1 list-inside list-disc text-sm text-neutral-700">
                {state.data.customization.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
            {state.data.customization.warnings.length ? (
              <ul className="list-inside list-disc rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                {state.data.customization.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-neutral-600">{state.data.disclaimer}</p>
            <button
              type="button"
              className="btn-primary w-full"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const response = await api.assist.customize(recipe.id, goals, { notes: notes.trim() || undefined, save: true });
                  if (response.recipe) onSaved(response.recipe.id);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? 'Saving…' : 'Save as a new recipe'}
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Recipe chat                                                                */
/* -------------------------------------------------------------------------- */

export function RecipeChat({ recipe }: { recipe: Recipe }) {
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const examples = ['Can I use chicken instead?', "I don't have parmesan.", 'Can I make this ahead of time?'];

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    setPending(true);
    setError(null);
    setQuestion('');
    const nextHistory = [...history, { role: 'user' as const, content: trimmed }];
    setHistory(nextHistory);
    try {
      const answer: ChatAnswer = await api.assist.chat(recipe.id, trimmed, history.slice(-8));
      setHistory([...nextHistory, { role: 'assistant', content: answer.answer }]);
      setSuggestions(answer.suggestions);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'UNKNOWN', 'The assistant did not answer. Try again.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card p-4" aria-label="Ask about this recipe">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <MessageCircle className="h-5 w-5 text-brand-500" aria-hidden="true" />
        Ask AI about this recipe
      </h2>

      {history.length === 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {examples.map((example) => (
            <li key={example}>
              <button type="button" className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700" onClick={() => void ask(example)}>
                {example}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="mt-3 space-y-2">
        {history.map((turn, index) => (
          <li
            key={index}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              turn.role === 'user' ? 'ml-auto bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-900'
            }`}
          >
            {turn.content}
          </li>
        ))}
      </ul>

      {pending ? <Spinner className="mt-2" label="Reading the recipe…" /> : null}
      {error ? (
        <div className="mt-2">
          <ErrorState error={error} onRetry={() => void ask(history[history.length - 1]?.content ?? '')} />
        </div>
      ) : null}

      {suggestions.length && !pending ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion} className="badge bg-emerald-100 text-emerald-800">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {suggestion}
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <input
          className="field flex-1"
          placeholder="Ask anything about this recipe"
          aria-label="Your question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit" className="btn-primary px-3" disabled={pending || question.trim().length < 2} aria-label="Send question">
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
