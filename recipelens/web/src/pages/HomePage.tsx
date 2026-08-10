import { BookOpen, Heart, PlusCircle, Search, Settings, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/AppShell.js';
import { EmptyState, ErrorState, SkeletonList } from '../components/feedback.js';
import { RecipeCard } from '../components/recipe.js';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useAuth } from '../state/AuthContext.js';

export function HomePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [debounced, setDebounced] = useState('');

  // Debounce so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const recipes = useAsync(() => api.recipes.list({ search: debounced || undefined, favorite: favoritesOnly }), [
    debounced,
    favoritesOnly,
  ]);
  const cooking = useAsync(() => api.cooking.active(), []);

  async function toggleFavorite(id: string, next: boolean) {
    // Optimistic: flip immediately, roll back if the server disagrees.
    recipes.setData((current) =>
      current
        ? { ...current, items: current.items.map((item) => (item.id === id ? { ...item, isFavorite: next } : item)) }
        : current!,
    );
    try {
      await api.recipes.setFavorite(id, next);
      if (favoritesOnly) await recipes.reload();
    } catch {
      await recipes.reload();
    }
  }

  const items = recipes.data?.items ?? [];
  const resumable = cooking.data?.sessions ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Hi, ${user?.displayName ?? 'cook'}`}
        subtitle="Your saved recipes"
        action={
          <Link to="/settings" className="btn-ghost px-2" aria-label="Settings">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
        }
      />

      {resumable.length > 0 ? (
        <section aria-label="Continue cooking" className="card border-brand-200 bg-brand-50/60 p-3">
          <h2 className="text-sm font-semibold text-brand-900">Continue cooking</h2>
          <ul className="mt-2 space-y-1">
            {resumable.map((session) => (
              <li key={session.id}>
                <Link className="text-sm font-medium text-brand-700 underline" to={`/recipes/${session.recipeId}/cook`}>
                  Resume at step {session.currentStep + 1}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            type="search"
            className="field pl-9"
            placeholder="Search recipes and ingredients"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search recipes"
          />
          {search ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className={favoritesOnly ? 'btn-primary px-3' : 'btn-secondary px-3'}
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((value) => !value)}
        >
          <Heart className={`h-4 w-4 ${favoritesOnly ? 'fill-white' : ''}`} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Favorites</span>
        </button>
      </div>

      {recipes.initializing ? <SkeletonList /> : null}
      {recipes.error ? <ErrorState error={recipes.error} onRetry={() => void recipes.reload()} /> : null}

      {!recipes.initializing && !recipes.error && items.length === 0 ? (
        favoritesOnly ? (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="No favorites yet"
            description="Tap the heart on a recipe to keep it close."
            action={
              <button type="button" className="btn-secondary" onClick={() => setFavoritesOnly(false)}>
                Show all recipes
              </button>
            }
          />
        ) : debounced ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No matches"
            description={`Nothing matched “${debounced}”. Try a different ingredient or title.`}
            action={
              <button type="button" className="btn-secondary" onClick={() => setSearch('')}>
                Clear search
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="No recipes yet"
            description="Import a cooking video, a link, a screenshot or paste a recipe to get started."
            action={
              <Link className="btn-primary" to="/import">
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Import a recipe
              </Link>
            }
          />
        )
      ) : null}

      <div className="space-y-3">
        {items.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} onToggleFavorite={toggleFavorite} />
        ))}
      </div>

      {items.length > 0 ? (
        <p className="pt-2 text-center text-xs text-neutral-500">
          {recipes.data?.total} recipe{recipes.data?.total === 1 ? '' : 's'}
        </p>
      ) : null}
    </div>
  );
}
