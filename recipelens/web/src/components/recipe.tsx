import { Clock, Heart, Repeat, Sparkles, Users, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RecipeListItem } from '../lib/api.js';
import type { ScaledIngredient } from '../shared.js';

export function RecipeCard({ recipe, onToggleFavorite }: { recipe: RecipeListItem; onToggleFavorite?: (id: string, next: boolean) => void }) {
  const minutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  return (
    <article className="card overflow-hidden">
      <div className="flex">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt=""
            loading="lazy"
            className="h-28 w-24 shrink-0 object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-28 w-24 shrink-0 items-center justify-center bg-brand-50 text-brand-500" aria-hidden="true">
            <Utensils className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/recipes/${recipe.id}`} className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-neutral-900">{recipe.title}</h3>
              {recipe.description ? <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600">{recipe.description}</p> : null}
            </Link>
            {onToggleFavorite ? (
              <button
                type="button"
                className="btn-ghost -mr-1 -mt-1 min-h-0 px-2 py-1"
                aria-label={recipe.isFavorite ? `Remove ${recipe.title} from favorites` : `Add ${recipe.title} to favorites`}
                aria-pressed={recipe.isFavorite}
                onClick={() => onToggleFavorite(recipe.id, !recipe.isFavorite)}
              >
                <Heart
                  className={`h-5 w-5 ${recipe.isFavorite ? 'fill-brand-500 text-brand-500' : 'text-neutral-400'}`}
                  aria-hidden="true"
                />
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
            {recipe.servings ? (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {recipe.servings} servings
              </span>
            ) : null}
            {minutes > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {minutes} min
              </span>
            ) : null}
            <span>
              {recipe.ingredientCount} ingredients · {recipe.stepCount} steps
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Marks the difference between what the source stated and what AI estimated. */
export function EstimatedBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`badge bg-amber-100 text-amber-800 ${className}`} title="Estimated by AI — please double-check">
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      AI estimate
    </span>
  );
}

export function ConfirmedBadge() {
  return <span className="badge bg-emerald-100 text-emerald-800">Confirmed</span>;
}

export function IngredientLine({ ingredient, onReplace }: { ingredient: ScaledIngredient; onReplace?: () => void }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2 last:border-0">
      <div className="min-w-0">
        <span className="font-medium text-neutral-900">{ingredient.name}</span>
        {ingredient.note ? <span className="ml-1 text-sm text-neutral-500">({ingredient.note})</span> : null}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {ingredient.optional ? <span className="badge bg-neutral-100 text-neutral-600">optional</span> : null}
          {ingredient.estimated ? <EstimatedBadge /> : null}
          {!ingredient.scalable && ingredient.quantity == null ? (
            <span className="badge bg-neutral-100 text-neutral-600">no amount given</span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="whitespace-nowrap font-semibold tabular-nums text-neutral-900">{ingredient.displayText || '—'}</span>
        {onReplace ? (
          <button
            type="button"
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-brand-600"
            aria-label={`Replace ${ingredient.name}`}
            title="Suggest a replacement"
            onClick={onReplace}
          >
            <Repeat className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </li>
  );
}
