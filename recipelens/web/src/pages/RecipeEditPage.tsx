import { GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorState, InlineError, LoadingScreen } from '../components/feedback.js';
import { api, ApiError, type Recipe } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { KNOWN_UNITS, formatQuantity, normalizeUnitToken, parseQuantity, type Ingredient, type Step } from '../shared.js';

interface EditableIngredient extends Omit<Ingredient, 'quantity'> {
  quantityText: string;
}

function toEditable(ingredient: Ingredient): EditableIngredient {
  const { quantity, ...rest } = ingredient;
  return { ...rest, quantityText: quantity == null ? '' : formatQuantity(quantity) };
}

export function RecipeEditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const state = useAsync(() => api.recipes.get(id), [id]);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<EditableIngredient[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.data) return;
    setRecipe(state.data.recipe);
    setIngredients(state.data.recipe.ingredients.map(toEditable));
    setSteps(state.data.recipe.steps);
  }, [state.data]);

  if (state.initializing) return <LoadingScreen label="Loading recipe…" />;
  if (state.error) return <ErrorState error={state.error} onRetry={() => void state.reload()} />;
  if (!recipe) return null;

  function update<K extends keyof Recipe>(key: K, value: Recipe[K]) {
    setRecipe((current) => (current ? { ...current, [key]: value } : current));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!recipe?.title.trim()) next.title = 'A recipe needs a title.';
    if (recipe?.servings != null && (recipe.servings < 1 || recipe.servings > 500)) next.servings = 'Servings must be between 1 and 500.';
    if (ingredients.length === 0) next.ingredients = 'Add at least one ingredient.';
    if (ingredients.some((ingredient) => !ingredient.name.trim())) next.ingredients = 'Every ingredient needs a name.';
    ingredients.forEach((ingredient, index) => {
      if (ingredient.quantityText.trim() && parseQuantity(ingredient.quantityText).value == null) {
        next[`ingredient-${index}`] = 'Use a number like 2, 0.5 or 1 1/2.';
      }
    });
    if (steps.length === 0) next.steps = 'Add at least one step.';
    if (steps.some((step) => !step.instruction.trim())) next.steps = 'Every step needs an instruction.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSave() {
    if (!recipe || !validate()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        ...recipe,
        ingredients: ingredients.map((ingredient, index) => {
          const { quantityText, ...rest } = ingredient;
          const quantity = quantityText.trim() ? parseQuantity(quantityText).value : null;
          return {
            ...rest,
            quantity,
            unit: normalizeUnitToken(rest.unit),
            // An amount the cook typed is no longer an AI guess.
            estimated: quantityText.trim() ? rest.estimated && quantity === null : rest.estimated,
            scalable: quantity != null && rest.scalable,
            position: index,
          };
        }),
        steps: steps.map((step, index) => ({ ...step, position: index })),
        version: recipe.version,
      };
      const saved = await api.recipes.update(recipe.id, payload);
      navigate(`/recipes/${saved.recipe.id}`);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN', 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Edit recipe</h1>
        <Link className="btn-ghost" to={`/recipes/${recipe.id}`}>
          Cancel
        </Link>
      </header>

      {saveError ? (
        <ErrorState
          error={saveError}
          onRetry={saveError.code === 'VERSION_CONFLICT' ? undefined : () => void onSave()}
          actions={
            saveError.code === 'VERSION_CONFLICT' ? (
              <button type="button" className="btn-secondary" onClick={() => void state.reload()}>
                Reload the latest version
              </button>
            ) : undefined
          }
        />
      ) : null}

      <section className="card space-y-3 p-4">
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input id="title" className="field" value={recipe.title} onChange={(event) => update('title', event.target.value)} maxLength={200} />
          <InlineError message={errors.title ?? null} />
        </div>

        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="field min-h-[80px]"
            value={recipe.description ?? ''}
            onChange={(event) => update('description', event.target.value || null)}
            maxLength={4000}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="servings">
              Servings
            </label>
            <input
              id="servings"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              className="field"
              value={recipe.servings ?? ''}
              onChange={(event) => update('servings', event.target.value ? Number(event.target.value) : null)}
            />
          </div>
          <div>
            <label className="label" htmlFor="prep">
              Prep (min)
            </label>
            <input
              id="prep"
              type="number"
              inputMode="numeric"
              min={0}
              className="field"
              value={recipe.prepMinutes ?? ''}
              onChange={(event) => update('prepMinutes', event.target.value ? Number(event.target.value) : null)}
            />
          </div>
          <div>
            <label className="label" htmlFor="cook">
              Cook (min)
            </label>
            <input
              id="cook"
              type="number"
              inputMode="numeric"
              min={0}
              className="field"
              value={recipe.cookMinutes ?? ''}
              onChange={(event) => update('cookMinutes', event.target.value ? Number(event.target.value) : null)}
            />
          </div>
        </div>
        <InlineError message={errors.servings ?? null} />

        <div>
          <label className="label" htmlFor="tags">
            Tags (comma separated)
          </label>
          <input
            id="tags"
            className="field"
            value={recipe.tags.join(', ')}
            onChange={(event) =>
              update(
                'tags',
                event.target.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 20),
              )
            }
          />
        </div>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ingredients</h2>
          <button
            type="button"
            className="btn-secondary min-h-[36px] px-3 text-xs"
            onClick={() =>
              setIngredients((current) => [
                ...current,
                {
                  name: '',
                  quantityText: '',
                  unit: null,
                  note: null,
                  optional: false,
                  estimated: false,
                  scalable: true,
                  group: null,
                  position: current.length,
                },
              ])
            }
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </button>
        </div>
        <InlineError message={errors.ingredients ?? null} />

        <ul className="mt-3 space-y-3">
          {ingredients.map((ingredient, index) => (
            <li key={index} className="rounded-xl border border-neutral-200 p-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden="true" />
                <input
                  className="field"
                  placeholder="Ingredient"
                  aria-label={`Ingredient ${index + 1} name`}
                  value={ingredient.name}
                  onChange={(event) =>
                    setIngredients((current) => current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))
                  }
                />
                <button
                  type="button"
                  className="btn-ghost px-2"
                  aria-label={`Remove ingredient ${index + 1}`}
                  onClick={() => setIngredients((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4 text-red-600" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  className="field"
                  placeholder="Amount (e.g. 1 1/2)"
                  aria-label={`Ingredient ${index + 1} amount`}
                  value={ingredient.quantityText}
                  onChange={(event) =>
                    setIngredients((current) =>
                      current.map((item, i) => (i === index ? { ...item, quantityText: event.target.value } : item)),
                    )
                  }
                />
                <input
                  className="field"
                  list="unit-options"
                  placeholder="Unit"
                  aria-label={`Ingredient ${index + 1} unit`}
                  value={ingredient.unit ?? ''}
                  onChange={(event) =>
                    setIngredients((current) =>
                      current.map((item, i) => (i === index ? { ...item, unit: event.target.value || null } : item)),
                    )
                  }
                />
              </div>
              <InlineError message={errors[`ingredient-${index}`] ?? null} />
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={ingredient.optional}
                    onChange={(event) =>
                      setIngredients((current) =>
                        current.map((item, i) => (i === index ? { ...item, optional: event.target.checked } : item)),
                      )
                    }
                  />
                  Optional
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={ingredient.estimated}
                    onChange={(event) =>
                      setIngredients((current) =>
                        current.map((item, i) => (i === index ? { ...item, estimated: event.target.checked } : item)),
                      )
                    }
                  />
                  Still an estimate
                </label>
              </div>
            </li>
          ))}
        </ul>
        <datalist id="unit-options">
          {KNOWN_UNITS.map((unit) => (
            <option key={unit} value={unit} />
          ))}
        </datalist>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Steps</h2>
          <button
            type="button"
            className="btn-secondary min-h-[36px] px-3 text-xs"
            onClick={() =>
              setSteps((current) => [
                ...current,
                { position: current.length, instruction: '', durationSeconds: null, temperatureC: null, estimated: false },
              ])
            }
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </button>
        </div>
        <InlineError message={errors.steps ?? null} />

        <ol className="mt-3 space-y-3">
          {steps.map((step, index) => (
            <li key={index} className="rounded-xl border border-neutral-200 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 text-sm font-bold text-neutral-500">{index + 1}</span>
                <textarea
                  className="field min-h-[70px]"
                  aria-label={`Step ${index + 1}`}
                  value={step.instruction}
                  onChange={(event) =>
                    setSteps((current) => current.map((item, i) => (i === index ? { ...item, instruction: event.target.value } : item)))
                  }
                />
                <button
                  type="button"
                  className="btn-ghost px-2"
                  aria-label={`Remove step ${index + 1}`}
                  onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4 text-red-600" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  className="field"
                  placeholder="Timer (minutes)"
                  aria-label={`Step ${index + 1} timer in minutes`}
                  value={step.durationSeconds ? Math.round(step.durationSeconds / 60) : ''}
                  onChange={(event) =>
                    setSteps((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, durationSeconds: event.target.value ? Number(event.target.value) * 60 : null } : item,
                      ),
                    )
                  }
                />
                <input
                  type="number"
                  className="field"
                  placeholder="Temperature °C"
                  aria-label={`Step ${index + 1} temperature`}
                  value={step.temperatureC ?? ''}
                  onChange={(event) =>
                    setSteps((current) =>
                      current.map((item, i) => (i === index ? { ...item, temperatureC: event.target.value ? Number(event.target.value) : null } : item)),
                    )
                  }
                />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="sticky bottom-24 flex gap-2">
        <button type="button" className="btn-primary flex-1" onClick={() => void onSave()} disabled={saving}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
