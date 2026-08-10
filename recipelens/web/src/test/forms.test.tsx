import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const login = vi.fn();
const registerUser = vi.fn();
const shoppingList = vi.fn();
const shoppingAdd = vi.fn();
const shoppingUpdate = vi.fn();
const shoppingRemove = vi.fn();
const shoppingClear = vi.fn();

vi.mock('../state/AuthContext.js', () => ({
  useAuth: () => ({ user: null, loading: false, error: null, login, register: registerUser, logout: vi.fn(), setUser: vi.fn() }),
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/api.js')>('../lib/api.js');
  return {
    ...actual,
    api: {
      shopping: { list: shoppingList, add: shoppingAdd, update: shoppingUpdate, remove: shoppingRemove, clear: shoppingClear },
    },
  };
});

const { AuthPage } = await import('../pages/AuthPage.js');
const { ShoppingPage } = await import('../pages/ShoppingPage.js');

beforeEach(() => {
  vi.clearAllMocks();
  shoppingList.mockResolvedValue({ items: [], counts: { total: 0, checked: 0 } });
  shoppingAdd.mockResolvedValue({
    added: [{ id: 'a', name: 'Eggs', quantity: 6, unit: 'piece', note: null, checked: false, recipeId: null, displayText: '6 pieces', createdAt: '', updatedAt: '' }],
    merged: [],
    items: [{ id: 'a', name: 'Eggs', quantity: 6, unit: 'piece', note: null, checked: false, recipeId: null, displayText: '6 pieces', createdAt: '', updatedAt: '' }],
  });
});

describe('AuthPage validation', () => {
  it('blocks a malformed email and a short password before calling the API', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthPage mode="sign-in" />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('submits valid credentials', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <AuthPage mode="sign-in" />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), 'cook@example.test');
    await user.type(screen.getByLabelText(/password/i), 'a-good-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('cook@example.test', 'a-good-password'));
  });
});

describe('ShoppingPage', () => {
  it('shows an empty state with a call to action', async () => {
    render(
      <MemoryRouter>
        <ShoppingPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/your shopping list is empty/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse recipes/i })).toBeInTheDocument();
  });

  it('rejects an unparseable quantity instead of sending it', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ShoppingPage />
      </MemoryRouter>,
    );
    await screen.findByText(/your shopping list is empty/i);

    await user.type(screen.getByLabelText('Item name'), 'Eggs');
    await user.type(screen.getByLabelText('Quantity'), 'abc');
    await user.click(screen.getByRole('button', { name: /add item/i }));

    expect(await screen.findByText(/use a number like/i)).toBeInTheDocument();
    expect(shoppingAdd).not.toHaveBeenCalled();
  });

  it('adds a valid item and renders it', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ShoppingPage />
      </MemoryRouter>,
    );
    await screen.findByText(/your shopping list is empty/i);

    await user.type(screen.getByLabelText('Item name'), 'Eggs');
    await user.type(screen.getByLabelText('Quantity'), '6');
    await user.type(screen.getByLabelText('Unit'), 'pieces');
    await user.click(screen.getByRole('button', { name: /add item/i }));

    await waitFor(() => expect(shoppingAdd).toHaveBeenCalledWith({ name: 'Eggs', quantity: 6, unit: 'piece' }));
    expect(await screen.findByText('Eggs')).toBeInTheDocument();
    expect(screen.getByText('6 pieces')).toBeInTheDocument();
  });
});
