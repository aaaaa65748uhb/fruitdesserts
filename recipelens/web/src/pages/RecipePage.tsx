import { ChefHat, Clock, ExternalLink, Heart, Minus, Pencil, Plus, ShoppingCart, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog, Modal } from '../components/Modal.js';
import { ErrorState, LoadingScreen, Spinner } from '../components/feedback.js';
import { EstimatedBadge, IngredientLine } from '../components/recipe.js';
import { api, type Collection } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { scaleRecipe, totalMinutes } from '../shared.js';

export function RecipePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const recipeState = useAsync(() => api.recipes.get(id), [id]);
  const collectionsState = useAsync(() => api.collections.list(), []);

  const [servings, setServings] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [listMessage, setListMessage] = useState<string | null>(null);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  const recipe = recipeState.data?.recipe ?? null;

  useEffect(() => {
    if (recipe && servings === null) setServings(recipe.servings ?? null);
  }, [recipe, servings]);

  const scaled = useMemo(() => {
    if (!recipe) return null;
    return scaleRecipe(recipe, servings ?? recipe.servings ?? null);
  }, [recipe, servings]);

  if (recipeState.initializing) return <LoadingScreen label="Loading recipe…" />;
  if (recipeState.error) {
    return (
      <ErrorState
        error={recipeState.error}
        onRetry={() => void recipeState.reload()}
        actions={
          <Link className="btn-secondary" to="/">
            Back to recipes
          </Link>
        }
      />
    );
  }
  if (!recipe || !scaled) return null;

  const minutes = totalMinutes(recipe);
  const estimatedCount = recipe.ingredients.filter((ingredient) => ingredient.estimated).length;

  async function toggleFavorite() {
    if (!recipe) return;
    const next = !recipe.isFavorite;
    recipeState.setData((current) => ({ ...current!, recipe: { ...current!.recipe, isFavorite: next } }));
    try {
      await api.recipes.setFavorite(recipe.id, next);
    } catch {
      await recipeState.reload();
    }
  }

  async function addToShoppingList() {
    if (!recipe) return;
    setAddingToList(true);
    setListMessage(null);
    try {
      const response = await api.shopping.fromRecipe({
        recipeId: recipe.id,
        servings: servings ?? recipe.servings ?? undefined,
      });
      const added = response.added.length;
      const merged = response.merged.length;
      setListMessage(
        merged > 0
          ? `Added ${added} item${added === 1 ? '' : 's'} and merged ${merged} into what you already had.`
          : `Added ${added} item${added === 1 ? '' : 's'} to your shopping list.`,
      );
    } catch (error) {
      setListMessage(error instanceof Error ? error.message : 'Could not update the shopping list.');
    } finally {
      setAddingToList(false);
    }
  }

  async function onDelete() {
    if (!recipe) return;
    setDeleting(true);
    try {
      await api.recipes.remove(recipe.id);
      navigate('/', { replace: true });
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
      await recipeState.reload();
    }
  }

  const currentServings = servings ?? recipe.servings ?? null;

  return (
    <div className="space-y-4 pb-4">
      {recipe.imageUrl ? (
        <img
          src={recipe.imageUrl}
          alt=""
          className="h-48 w-full rounded-2xl object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : null}

      <header>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{recipe.title}</h1>
          <button
            type="button"
            className="btn-ghost px-2"
            aria-pressed={recipe.isFavorite}
            aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={() => void toggleFavorite()}
          >
            <Heart className={`h-6 w-6 ${recipe.isFavorite ? 'fill-brand-500 text-brand-500' : 'text-neutral-400'}`} aria-hidden="true" />
          </button>
        </div>
        {recipe.description ? <p className="mt-1 text-neutral-700">{recipe.description}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600">
          {minutes != null ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {minutes} min
            </span>
          ) : null}
          {recipe.difficulty ? <span className="badge bg-neutral-100 text-neutral-700">{recipe.difficulty}</span> : null}
          {recipe.cuisine ? <span className="badge bg-neutral-100 text-neutral-700">{recipe.cuisine}</span> : null}
          {recipe.sourceUrl ? (
            <a className="inline-flex items-center gap-1 text-brand-600 underline" href={recipe.sourceUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Source
            </a>
          ) : null}
        </div>

        {recipe.missingInfo.length > 0 ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            The source never stated: {recipe.missingInfo.join(', ')}. Nothing was invented — add the details when you edit.
          </p>
        ) : null}
      </header>

      <section className="card p-4" aria-label="Ingredients">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ingredients</h2>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-neutral-500" aria-hidden="true" />
            <div className="flex items-center rounded-xl border border-neutral-300">
              <button
                type="button"
                className="min-h-[40px] px-3 text-lg font-semibold disabled:opacity-40"
                aria-label="Fewer servings"
                disabled={!currentServings || currentServings <= 1}
                onClick={() => setServings((value) => Math.max(1, (value ?? recipe.servings ?? 1) - 1))}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-[3ch] text-center text-sm font-semibold tabular-nums" aria-live="polite">
                {currentServings ?? '—'}
              </span>
              <button
                type="button"
                className="min-h-[40px] px-3 text-lg font-semibold disabled:opacity-40"
                aria-label="More servings"
                disabled={!currentServings || currentServings >= 100}
                onClick={() => setServings((value) => Math.min(100, (value ?? recipe.servings ?? 1) + 1))}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {recipe.servings == null ? (
          <p className="mt-2 text-xs text-neutral-500">
            The source did not say how many people this serves, so amounts are shown exactly as written.
          </p>
        ) : scaled.factor !== 1 ? (
          <p className="mt-2 text-xs text-neutral-500">
            Scaled ×{scaled.factor.toFixed(2).replace(/\.00$/, '')} from {recipe.servings} servings.
          </p>
        ) : null}

        <ul className="mt-3">
          {scaled.ingredients.map((ingredient, index) => (
            <IngredientLine key={ingredient.id ?? index} ingredient={ingredient} />
          ))}
        </ul>

        {estimatedCount > 0 ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
            <EstimatedBadge /> {estimatedCount} amount{estimatedCount === 1 ? ' was' : 's were'} estimated by the AI — check before
            you cook.
          </p>
        ) : null}

        <button type="button" className="btn-secondary mt-4 w-full" onClick={() => void addToShoppingList()} disabled={addingToList}>
          {addingToList ? <Spinner label="Adding…" /> : (
            <>
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              Add to shopping list
            </>
          )}
        </button>
        {listMessage ? (
          <p className="mt-2 text-sm text-neutral-700" aria-live="polite">
            {listMessage}{' '}
            <Link className="font-semibold text-brand-600 underline" to="/shopping">
              View list
            </Link>
          </p>
        ) : null}
      </section>

      <section className="card p-4" aria-label="Steps">
        <h2 className="text-lg font-semibold">Method</h2>
        <ol className="mt-3 space-y-3">
          {recipe.steps.map((step, index) => (
            <li key={step.id ?? index} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {index + 1}
              </span>
              <div>
                <p className="text-neutral-800">{step.instruction}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500">
                  {step.durationSeconds ? <span>{Math.round(step.durationSeconds / 60)} min</span> : null}
                  {step.temperatureC != null ? <span>{step.temperatureC}°C</span> : null}
                  {step.estimated ? <EstimatedBadge /> : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {recipe.equipment.length || recipe.tags.length || recipe.notes ? (
        <section className="card space-y-2 p-4 text-sm text-neutral-700">
          {recipe.equipment.length ? <p><span className="font-semibold">Equipment:</span> {recipe.equipment.join(', ')}</p> : null}
          {recipe.tags.length ? <p><span className="font-semibold">Tags:</span> {recipe.tags.join(', ')}</p> : null}
          {recipe.notes ? <p><span className="font-semibold">Notes:</span> {recipe.notes}</p> : null}
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Link className="btn-primary col-span-2" to={`/recipes/${recipe.id}/cook`}>
          <ChefHat className="h-4 w-4" aria-hidden="true" />
          Start cooking
        </Link>
        <Link className="btn-secondary" to={`/recipes/${recipe.id}/edit`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Link>
        <button type="button" className="btn-secondary" onClick={() => setCollectionsOpen(true)}>
          Collections
        </button>
        <button type="button" className="btn-danger col-span-2" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete recipe
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this recipe?"
        message="This removes the recipe, its ingredients and its steps. It cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirmDelete(false)}
      />

      <CollectionPicker
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        collections={collectionsState.data?.collections ?? []}
        selected={recipeState.data?.collectionIds ?? []}
        onChanged={async () => {
          await Promise.all([recipeState.reload(), collectionsState.reload()]);
        }}
        recipeId={recipe.id}
      />
    </div>
  );
}

function CollectionPicker({
  open,
  onClose,
  collections,
  selected,
  recipeId,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  collections: Collection[];
  selected: string[];
  recipeId: string;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function toggle(collectionId: string, next: boolean) {
    setBusy(collectionId);
    setError(null);
    try {
      if (next) await api.collections.addRecipe(collectionId, recipeId);
      else await api.collections.removeRecipe(collectionId, recipeId);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the collection.');
    } finally {
      setBusy(null);
    }
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    setBusy('new');
    setError(null);
    try {
      const created = await api.collections.create(newName.trim());
      await api.collections.addRecipe(created.collection.id, recipeId);
      setNewName('');
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the collection.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} title="Add to a collection" onClose={onClose}>
      {collections.length === 0 ? <p className="text-sm text-neutral-600">You have no collections yet — create one below.</p> : null}
      <ul className="space-y-2">
        {collections.map((collection) => {
          const isIn = selected.includes(collection.id);
          return (
            <li key={collection.id} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{collection.name}</span>
              <button
                type="button"
                className={isIn ? 'btn-secondary min-h-[36px] px-3 text-xs' : 'btn-primary min-h-[36px] px-3 text-xs'}
                disabled={busy === collection.id}
                onClick={() => void toggle(collection.id, !isIn)}
              >
                {busy === collection.id ? '…' : isIn ? 'Remove' : 'Add'}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex gap-2">
        <input
          className="field"
          placeholder="New collection name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          aria-label="New collection name"
        />
        <button type="button" className="btn-primary" onClick={() => void createAndAdd()} disabled={busy === 'new' || !newName.trim()}>
          Create
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
