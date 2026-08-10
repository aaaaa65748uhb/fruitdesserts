import { FolderHeart, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/AppShell.js';
import { ConfirmDialog } from '../components/Modal.js';
import { EmptyState, ErrorState, InlineError, SkeletonList } from '../components/feedback.js';
import { RecipeCard } from '../components/recipe.js';
import { api, type Collection } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';

export function CollectionsPage() {
  const state = useAsync(() => api.collections.list(), []);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Collection | null>(null);

  const collections = state.data?.collections ?? [];

  async function create() {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Give the collection a name.');
      return;
    }
    setBusy(true);
    try {
      await api.collections.create(name.trim());
      setName('');
      await state.reload();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create that collection.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await api.collections.remove(pendingDelete.id);
      if (openId === pendingDelete.id) setOpenId(null);
      await state.reload();
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Collections" subtitle="Group recipes however you cook — weeknights, baking, guests." />

      <form
        className="card p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <div className="flex gap-2">
          <input className="field flex-1" placeholder="New collection" value={name} onChange={(event) => setName(event.target.value)} aria-label="Collection name" />
          <button type="submit" className="btn-primary px-3" disabled={busy} aria-label="Create collection">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <InlineError message={formError} />
      </form>

      {state.initializing ? <SkeletonList rows={2} /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={() => void state.reload()} /> : null}

      {!state.initializing && !state.error && collections.length === 0 ? (
        <EmptyState
          icon={<FolderHeart className="h-6 w-6" />}
          title="No collections yet"
          description="Create one above, then add recipes to it from any recipe page."
        />
      ) : null}

      <ul className="space-y-2">
        {collections.map((collection) => (
          <li key={collection.id} className="card p-3">
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(openId === collection.id ? null : collection.id)} aria-expanded={openId === collection.id}>
                <span className="font-semibold">{collection.name}</span>
                <span className="ml-2 text-sm text-neutral-500">
                  {collection.recipeCount} recipe{collection.recipeCount === 1 ? '' : 's'}
                </span>
              </button>
              <button type="button" className="btn-ghost px-2" aria-label={`Delete ${collection.name}`} onClick={() => setPendingDelete(collection)}>
                <Trash2 className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              </button>
            </div>
            {openId === collection.id ? <CollectionRecipes collectionId={collection.id} /> : null}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this collection?"
        message="The recipes stay in your library — only the grouping is removed."
        confirmLabel="Delete"
        destructive
        pending={busy}
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function CollectionRecipes({ collectionId }: { collectionId: string }) {
  const state = useAsync(() => api.recipes.list({ collectionId }), [collectionId]);

  if (state.initializing) return <SkeletonList rows={1} />;
  if (state.error) return <ErrorState error={state.error} onRetry={() => void state.reload()} />;

  const items = state.data?.items ?? [];
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-neutral-600">Nothing here yet. Open a recipe and use “Collections” to add it.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {items.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}
