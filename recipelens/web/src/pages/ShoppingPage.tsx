import { Check, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/AppShell.js';
import { EmptyState, ErrorState, InlineError, SkeletonList } from '../components/feedback.js';
import { api, type ShoppingItem } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { formatQuantity, normalizeUnitToken, parseQuantity } from '../shared.js';

export function ShoppingPage() {
  const state = useAsync(() => api.shopping.list(), []);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const items = state.data?.items ?? [];
  const checkedCount = items.filter((item) => item.checked).length;

  async function addItem() {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Give the item a name.');
      return;
    }
    const quantity = amount.trim() ? parseQuantity(amount).value : null;
    if (amount.trim() && quantity == null) {
      setFormError('Use a number like 2, 0.5 or 1 1/2.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.shopping.add({ name: name.trim(), quantity, unit: normalizeUnitToken(unit) });
      state.setData((current) => ({ items: response.items, counts: current?.counts ?? { total: 0, checked: 0 } }));
      setName('');
      setAmount('');
      setUnit('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not add that item.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: ShoppingItem) {
    state.setData((current) => ({
      ...current!,
      items: current!.items.map((entry) => (entry.id === item.id ? { ...entry, checked: !entry.checked } : entry)),
    }));
    try {
      await api.shopping.update(item.id, { checked: !item.checked });
    } catch {
      await state.reload();
    }
  }

  async function remove(item: ShoppingItem) {
    state.setData((current) => ({ ...current!, items: current!.items.filter((entry) => entry.id !== item.id) }));
    try {
      await api.shopping.remove(item.id);
    } catch {
      await state.reload();
    }
  }

  async function clearChecked() {
    setBusy(true);
    try {
      await api.shopping.clear(true);
      await state.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shopping list"
        subtitle={items.length ? `${items.length} item${items.length === 1 ? '' : 's'} · ${checkedCount} ticked off` : undefined}
        action={
          checkedCount > 0 ? (
            <button type="button" className="btn-secondary min-h-[38px] px-3 text-xs" onClick={() => void clearChecked()} disabled={busy}>
              Clear ticked
            </button>
          ) : undefined
        }
      />

      <form
        className="card space-y-2 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void addItem();
        }}
      >
        <div className="flex gap-2">
          <input className="field flex-1" placeholder="Add an item" value={name} onChange={(event) => setName(event.target.value)} aria-label="Item name" />
          <input className="field w-20" placeholder="Qty" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label="Quantity" />
          <input className="field w-20" placeholder="Unit" value={unit} onChange={(event) => setUnit(event.target.value)} aria-label="Unit" />
          <button type="submit" className="btn-primary px-3" disabled={busy} aria-label="Add item">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <InlineError message={formError} />
      </form>

      {state.initializing ? <SkeletonList rows={4} /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={() => void state.reload()} /> : null}

      {!state.initializing && !state.error && items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-6 w-6" />}
          title="Your shopping list is empty"
          description="Add items by hand, or open a recipe and send its ingredients here."
          action={
            <Link className="btn-primary" to="/">
              Browse recipes
            </Link>
          }
        />
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className={`card flex items-center gap-3 p-3 ${item.checked ? 'opacity-60' : ''}`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={item.checked}
              aria-label={`${item.checked ? 'Uncheck' : 'Check'} ${item.name}`}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                item.checked ? 'border-brand-500 bg-brand-500 text-white' : 'border-neutral-300'
              }`}
              onClick={() => void toggle(item)}
            >
              {item.checked ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </button>

            {editing === item.id ? (
              <InlineEditor
                item={item}
                onCancel={() => setEditing(null)}
                onSaved={(updated) => {
                  state.setData((current) => ({
                    ...current!,
                    items: current!.items.map((entry) => (entry.id === updated.id ? updated : entry)),
                  }));
                  setEditing(null);
                }}
              />
            ) : (
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(item.id)}>
                <span className={`font-medium ${item.checked ? 'line-through' : ''}`}>{item.name}</span>
                {item.displayText ? <span className="ml-2 text-sm text-neutral-600 tabular-nums">{item.displayText}</span> : null}
              </button>
            )}

            <button type="button" className="btn-ghost px-2" aria-label={`Remove ${item.name}`} onClick={() => void remove(item)}>
              <Trash2 className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlineEditor({
  item,
  onSaved,
  onCancel,
}: {
  item: ShoppingItem;
  onSaved: (item: ShoppingItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.quantity == null ? '' : formatQuantity(item.quantity));
  const [unit, setUnit] = useState(item.unit ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      setError('Give the item a name.');
      return;
    }
    const quantity = amount.trim() ? parseQuantity(amount).value : null;
    if (amount.trim() && quantity == null) {
      setError('Use a number like 2, 0.5 or 1 1/2.');
      return;
    }
    setSaving(true);
    try {
      const response = await api.shopping.update(item.id, { name: name.trim(), quantity, unit: normalizeUnitToken(unit) });
      onSaved(response.item);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that change.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex gap-1">
        <input className="field flex-1" value={name} onChange={(event) => setName(event.target.value)} aria-label="Item name" autoFocus />
        <input className="field w-16" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label="Quantity" />
        <input className="field w-16" value={unit} onChange={(event) => setUnit(event.target.value)} aria-label="Unit" />
      </div>
      <div className="mt-1 flex gap-2">
        <button type="button" className="btn-primary min-h-[32px] px-3 text-xs" onClick={() => void save()} disabled={saving}>
          Save
        </button>
        <button type="button" className="btn-ghost min-h-[32px] px-3 text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <InlineError message={error} />
    </div>
  );
}
