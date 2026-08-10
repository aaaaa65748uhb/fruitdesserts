import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRecipe } from './fixtures.js';

const getRecipe = vi.fn();
const listCollections = vi.fn();
const fromRecipe = vi.fn();
const setFavorite = vi.fn();

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/api.js')>('../lib/api.js');
  return {
    ...actual,
    api: {
      recipes: { get: getRecipe, setFavorite },
      collections: { list: listCollections },
      shopping: { fromRecipe },
    },
  };
});

const { RecipePage } = await import('../pages/RecipePage.js');

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/recipes/r1']}>
      <Routes>
        <Route path="/recipes/:id" element={<RecipePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getRecipe.mockResolvedValue({ recipe: makeRecipe(), collectionIds: [] });
  listCollections.mockResolvedValue({ collections: [] });
  fromRecipe.mockResolvedValue({ added: [{ id: 'x' }], merged: [], items: [] });
  setFavorite.mockResolvedValue({ id: 'r1', isFavorite: true });
});

describe('RecipePage', () => {
  it('shows the stored amounts and marks AI estimates', async () => {
    renderPage();
    expect(await screen.findByText('Creamy Garlic Pasta')).toBeInTheDocument();
    expect(screen.getByText('200 g')).toBeInTheDocument();
    expect(screen.getByText('150 ml')).toBeInTheDocument();
    expect(screen.getAllByTitle(/Estimated by AI/i).length).toBeGreaterThan(0);
  });

  it('rescales every scalable amount when the servings change', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('200 g');

    await user.click(screen.getByRole('button', { name: /more servings/i }));
    await waitFor(() => expect(screen.getByText('300 g')).toBeInTheDocument());
    expect(screen.getByText('225 ml')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /more servings/i }));
    await waitFor(() => expect(screen.getByText('400 g')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /fewer servings/i }));
    await user.click(screen.getByRole('button', { name: /fewer servings/i }));
    await user.click(screen.getByRole('button', { name: /fewer servings/i }));
    await waitFor(() => expect(screen.getByText('100 g')).toBeInTheDocument());
  });

  it('never scales an ingredient with no stated amount', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('200 g');
    await user.click(screen.getByRole('button', { name: /more servings/i }));

    const saltRow = screen.getByText('salt').closest('li')!;
    expect(saltRow.textContent).toContain('—');
  });

  it('sends the chosen servings to the shopping list', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('200 g');

    await user.click(screen.getByRole('button', { name: /more servings/i }));
    await user.click(screen.getByRole('button', { name: /add to shopping list/i }));

    await waitFor(() => expect(fromRecipe).toHaveBeenCalledWith({ recipeId: 'r1', servings: 3 }));
    expect(await screen.findByText(/Added 1 item/)).toBeInTheDocument();
  });

  it('explains when the source never stated the servings', async () => {
    getRecipe.mockResolvedValue({
      recipe: makeRecipe({ servings: null, missingInfo: ['servings'] }),
      collectionIds: [],
    });
    renderPage();
    expect(await screen.findByText(/did not say how many people/i)).toBeInTheDocument();
    expect(screen.getByText(/never stated: servings/i)).toBeInTheDocument();
  });
});
