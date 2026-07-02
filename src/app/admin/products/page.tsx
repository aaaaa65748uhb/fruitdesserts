'use client';

import { useState } from 'react';
import ProductFormModal from '@/components/ProductFormModal';
import { getDataSource } from '@/lib/data';
import type { Product } from '@/lib/data/types';
import { useProducts } from '@/lib/hooks';
import { formatPrice } from '@/lib/format';

export default function AdminProductsPage() {
  const { products, loading } = useProducts();
  const [modalProduct, setModalProduct] = useState<Product | null | 'new'>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, successMessage?: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      if (successMessage) setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'הפעולה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const handleSeed = () =>
    run(async () => {
      const added = await getDataSource().seedProducts();
      setMessage(added > 0 ? `נוספו ${added} מוצרי דמו לקטלוג ✅` : 'כל מוצרי הדמו כבר קיימים בקטלוג');
    });

  const handleDelete = (product: Product) => {
    if (!window.confirm(`למחוק את "${product.name}" לצמיתות?`)) return;
    void run(() => getDataSource().deleteProduct(product.id), `"${product.name}" נמחק`);
  };

  const toggleActive = (product: Product) =>
    run(() => getDataSource().updateProduct(product.id, { active: !product.active }));

  const updateStock = (product: Product, stock: number) => {
    if (Number.isNaN(stock) || stock < 0) return;
    void run(() => getDataSource().updateProduct(product.id, { stock }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-black">ניהול מוצרים 🧸</h2>
        <div className="flex gap-2">
          <button onClick={() => void handleSeed()} disabled={busy} className="btn-secondary !py-2 text-sm">
            ייבוא מוצרי דמו 📦
          </button>
          <button onClick={() => setModalProduct('new')} disabled={busy} className="btn-primary !py-2 text-sm">
            + מוצר חדש
          </button>
        </div>
      </div>

      {message && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 font-bold text-emerald-700">{message}</p>
      )}
      {error && (
        <p className="rounded-2xl bg-squid-pink-light/60 px-4 py-3 font-bold text-squid-pink-dark">
          ❌ {error}
        </p>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-squid-ink/60">טוען מוצרים...</div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center text-squid-ink/60">
            <span className="text-4xl">🧸</span>
            <p className="mt-2">הקטלוג ריק — הוסיפו מוצר חדש או ייבאו את מוצרי הדמו</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>מוצר</th>
                  <th>קטגוריה</th>
                  <th>מחיר</th>
                  <th>מבצע</th>
                  <th>מלאי</th>
                  <th>סטטוס</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className={product.active ? '' : 'opacity-50'}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
                          style={{
                            background: `linear-gradient(135deg, ${product.colors[0]}, ${product.colors[1]})`,
                          }}
                        >
                          {product.emoji}
                        </span>
                        <div>
                          <div className="font-bold">{product.name}</div>
                          <div className="text-xs text-squid-ink/50">{product.englishName}</div>
                        </div>
                      </div>
                    </td>
                    <td>{product.category}</td>
                    <td className="font-bold">{formatPrice(product.price)}</td>
                    <td>
                      {product.salePrice ? (
                        <span className="font-bold text-squid-pink-dark">
                          {formatPrice(product.salePrice)}
                        </span>
                      ) : (
                        <span className="text-squid-ink/40">—</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        defaultValue={product.stock}
                        key={`${product.id}-${product.stock}`}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (value !== product.stock) updateStock(product, value);
                        }}
                        className={`w-20 rounded-xl border-2 px-2 py-1 text-center font-bold ${
                          product.stock <= 5
                            ? 'border-squid-pink bg-squid-pink-light/30 text-squid-pink-dark'
                            : 'border-squid-purple-light'
                        }`}
                        aria-label={`מלאי ${product.name}`}
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => void toggleActive(product)}
                        className={`chip ${
                          product.active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {product.active ? '✅ פעיל' : '⏸️ מושבת'}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setModalProduct(product)}
                          className="rounded-full bg-squid-purple-light/50 px-3 py-1 text-xs font-bold text-squid-purple-dark hover:bg-squid-purple-light"
                        >
                          ✏️ עריכה
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="rounded-full bg-squid-pink-light/50 px-3 py-1 text-xs font-bold text-squid-pink-dark hover:bg-squid-pink-light"
                        >
                          🗑️ מחיקה
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalProduct !== null && (
        <ProductFormModal
          product={modalProduct === 'new' ? null : modalProduct}
          onClose={() => setModalProduct(null)}
        />
      )}
    </div>
  );
}
