import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRecipe } from './fixtures.js';

const getRecipe = vi.fn();
const getSession = vi.fn();
const saveSession = vi.fn();

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/api.js')>('../lib/api.js');
  return {
    ...actual,
    api: {
      recipes: { get: getRecipe },
      cooking: { get: getSession, save: saveSession },
    },
  };
});

const { CookPage } = await import('../pages/CookPage.js');

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/recipes/r1/cook']}>
      <Routes>
        <Route path="/recipes/:id/cook" element={<CookPage />} />
        <Route path="/recipes/:id" element={<p>recipe page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getRecipe.mockResolvedValue({ recipe: makeRecipe(), collectionIds: [] });
  getSession.mockResolvedValue({ session: null });
  saveSession.mockResolvedValue({ session: null });
});

describe('CookPage', () => {
  it('walks through the steps and records progress', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Boil the pasta.')).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(await screen.findByText('Fry the garlic.')).toBeInTheDocument();
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(await screen.findByText('Boil the pasta.')).toBeInTheDocument();

    await waitFor(() => expect(saveSession).toHaveBeenCalled());
  });

  it('tracks completed steps in the progress bar', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Boil the pasta.');

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
    expect(screen.getByRole('button', { name: /go to step 1 \(done\)/i })).toBeInTheDocument();
  });

  it('resumes from the progress kept on the device after a refresh', async () => {
    localStorage.setItem('recipelens:cooking:r1', JSON.stringify({ currentStep: 2, completedSteps: [0, 1], servings: 4 }));
    renderPage();

    expect(await screen.findByText('Toss everything together.')).toBeInTheDocument();
    expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/4 servings/i)).toBeInTheDocument();
  });

  it('prefers the server session when it is further along', async () => {
    localStorage.setItem('recipelens:cooking:r1', JSON.stringify({ currentStep: 0, completedSteps: [], servings: 2 }));
    getSession.mockResolvedValue({
      session: { id: 'c1', recipeId: 'r1', currentStep: 1, completedSteps: [0], servings: 2, startedAt: '', updatedAt: '', completedAt: null },
    });
    renderPage();

    expect(await screen.findByText('Fry the garlic.')).toBeInTheDocument();
  });

  it('scales the ingredient list to the servings being cooked', async () => {
    localStorage.setItem('recipelens:cooking:r1', JSON.stringify({ currentStep: 0, completedSteps: [], servings: 4 }));
    renderPage();

    await screen.findByText('Boil the pasta.');
    expect(screen.getByText('400 g')).toBeInTheDocument();
  });

  it('runs a step timer without blocking navigation', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Boil the pasta.');

    expect(screen.getByText('8:00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument());
  });
});
