'use client';

import { useState } from 'react';
import { getDataSource } from '@/lib/data';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_TAGS,
  type Product,
  type ProductCategory,
  type ProductTag,
} from '@/lib/data/types';

interface Props {
  product: Product | null; // null = מוצר חדש
  onClose: () => void;
}

const COLOR_PRESETS: [string, string][] = [
  ['#FFD6EB', '#E9D5FF'],
  ['#FFD6EB', '#D0F0FF'],
  ['#E9D5FF', '#D0F0FF'],
  ['#FFF3C4', '#FFD6EB'],
  ['#FFB3D9', '#E9D5FF'],
  ['#D0F0FF', '#E9D5FF'],
];

export default function ProductFormModal({ product, onClose }: Props) {
  const [name, setName] = useState(product?.name ?? '');
  const [englishName, setEnglishName] = useState(product?.englishName ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? 'אוכל חמוד');
  const [price, setPrice] = useState(product?.price?.toString() ?? '');
  const [salePrice, setSalePrice] = useState(product?.salePrice?.toString() ?? '');
  const [stock, setStock] = useState(product?.stock?.toString() ?? '20');
  const [emoji, setEmoji] = useState(product?.emoji ?? '🧸');
  const [colors, setColors] = useState<[string, string]>(product?.colors ?? COLOR_PRESETS[0]);
  const [tags, setTags] = useState<ProductTag[]>(product?.tags ?? []);
  const [active, setActive] = useState(product?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: ProductTag) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const priceNum = Number(price);
    const saleNum = salePrice.trim() ? Number(salePrice) : null;
    const stockNum = Number(stock);

    if (name.trim().length < 2) return setError('נא להזין שם מוצר');
    if (!priceNum || priceNum <= 0) return setError('נא להזין מחיר תקין');
    if (saleNum !== null && (saleNum <= 0 || saleNum >= priceNum)) {
      return setError('מחיר המבצע חייב להיות נמוך מהמחיר הרגיל');
    }
    if (Number.isNaN(stockNum) || stockNum < 0) return setError('נא להזין כמות מלאי תקינה');

    const data = {
      name: name.trim(),
      englishName: englishName.trim() || name.trim(),
      description: description.trim(),
      category,
      price: priceNum,
      salePrice: saleNum,
      stock: stockNum,
      emoji: emoji.trim() || '🧸',
      colors,
      tags,
      active,
    };

    setSaving(true);
    try {
      if (product) {
        await getDataSource().updateProduct(product.id, data);
      } else {
        await getDataSource().addProduct(data);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'השמירה נכשלה');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-squid-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl animate-pop overflow-y-auto rounded-squish bg-white p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl font-black">
            {product ? `עריכת ${product.name}` : 'מוצר חדש 🆕'}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-xl hover:bg-squid-pink-light" aria-label="סגירה">
            ✖️
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-name" className="mb-1 block font-bold">שם המוצר *</label>
              <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="כופתה מחייכת" />
            </div>
            <div>
              <label htmlFor="pf-english" className="mb-1 block font-bold">שם דגם (באנגלית)</label>
              <input id="pf-english" dir="ltr" value={englishName} onChange={(e) => setEnglishName(e.target.value)} className="input-field text-left" placeholder="Dumpling" />
            </div>
          </div>

          <div>
            <label htmlFor="pf-description" className="mb-1 block font-bold">תיאור</label>
            <textarea id="pf-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="input-field resize-none" placeholder="תיאור שיווקי קצר ומתוק..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="pf-category" className="mb-1 block font-bold">קטגוריה</label>
              <select id="pf-category" value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)} className="input-field">
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pf-price" className="mb-1 block font-bold">מחיר (₪) *</label>
              <input id="pf-price" type="number" min="0" step="0.1" value={price} onChange={(e) => setPrice(e.target.value)} className="input-field" placeholder="49.9" />
            </div>
            <div>
              <label htmlFor="pf-sale" className="mb-1 block font-bold">מחיר מבצע (₪)</label>
              <input id="pf-sale" type="number" min="0" step="0.1" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="input-field" placeholder="ריק = אין מבצע" />
            </div>
            <div>
              <label htmlFor="pf-stock" className="mb-1 block font-bold">מלאי *</label>
              <input id="pf-stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="input-field" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-emoji" className="mb-1 block font-bold">אימוג׳י המוצר</label>
              <input id="pf-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} className="input-field text-center text-2xl" maxLength={4} />
            </div>
            <div>
              <span className="mb-1 block font-bold">צבעי רקע</span>
              <div className="flex gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.join('-')}
                    type="button"
                    onClick={() => setColors(preset)}
                    className={`h-10 w-10 rounded-xl border-4 transition-transform hover:scale-110 ${
                      colors[0] === preset[0] && colors[1] === preset[1]
                        ? 'border-squid-ink'
                        : 'border-transparent'
                    }`}
                    style={{ background: `linear-gradient(135deg, ${preset[0]}, ${preset[1]})` }}
                    aria-label={`ערכת צבעים ${preset.join(' ')}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="mb-1 block font-bold">תגיות</span>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`chip transition-colors ${
                    tags.includes(tag)
                      ? 'bg-squid-purple text-white'
                      : 'bg-squid-purple-light/50 text-squid-purple-dark'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 font-bold">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-5 w-5 rounded accent-squid-purple"
            />
            המוצר פעיל ומוצג בחנות
          </label>

          {error && (
            <p className="rounded-2xl bg-squid-pink-light/60 px-4 py-3 font-bold text-squid-pink-dark">
              ❌ {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary !py-2">
              ביטול
            </button>
            <button type="submit" disabled={saving} className="btn-primary !py-2">
              {saving ? 'שומר...' : product ? 'שמירת שינויים 💾' : 'הוספת מוצר ➕'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
