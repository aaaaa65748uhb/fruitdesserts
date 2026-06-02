import { useState, useMemo } from 'react'
import { useFridge } from '../context/FridgeContext'
import { ISRAELI_PRODUCTS } from '../data/products'
import { STORES } from '../data/stores'

export default function ShoppingPage() {
  const { shoppingList, addToShopping, toggleShoppingItem, removeFromShopping, clearCheckedItems, getLowItems } = useFridge()
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchResults, setSearchResults] = useState([])

  const unchecked = shoppingList.filter(i => !i.checked)
  const checked = shoppingList.filter(i => i.checked)
  const lowItems = getLowItems().filter(li => !shoppingList.some(s => s.productId === li.productId))

  function handleSearch(q) {
    setSearch(q)
    if (!q) { setSearchResults([]); return }
    setSearchResults(ISRAELI_PRODUCTS.filter(p => p.name.includes(q) || p.brand.includes(q)).slice(0, 6))
  }

  function bestPrice(product) {
    const min = Math.min(...Object.values(product.prices))
    const store = Object.entries(product.prices).find(([, v]) => v === min)
    return { price: min, store: STORES.find(s => s.id === store?.[0])?.name || '' }
  }

  const groupedUnchecked = useMemo(() => {
    const groups = {}
    unchecked.forEach(item => {
      const cat = item.product.category
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })
    return groups
  }, [unchecked])

  const totalBestPrice = useMemo(() => {
    return shoppingList.filter(i => !i.checked).reduce((sum, item) => {
      return sum + Math.min(...Object.values(item.product.prices)) * item.quantity
    }, 0)
  }, [shoppingList])

  return (
    <div className="page-content">
      <div className="gradient-header" style={{ padding: '1rem 1rem 1.5rem', background: 'linear-gradient(135deg, #16A34A, #0D9488)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>🛒 רשימת קניות</h1>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.85, fontSize: '0.82rem' }}>{unchecked.length} פריטים · ₪{totalBestPrice.toFixed(2)} מחיר מינימלי</p>
          </div>
          {checked.length > 0 && (
            <button
              onClick={clearCheckedItems}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '0.45rem 0.75rem', color: 'white', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
            >
              נקה שהושלמו
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 0.75rem', marginTop: '-0.75rem' }}>
        {/* Add item search */}
        <div className="card" style={{ marginBottom: '0.75rem', position: 'relative' }}>
          <input
            value={search}
            onChange={e => { handleSearch(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
            placeholder="🔍 הוסף מוצר לרשימה..."
            style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.88rem' }}
          />
          {showSearch && searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 50, background: 'white', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB', marginTop: 4 }}>
              {searchResults.map(p => (
                <div
                  key={p.id}
                  onClick={() => { addToShopping(p, 1); setSearch(''); setShowSearch(false); setSearchResults([]) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}
                >
                  <span style={{ fontSize: '1.4rem' }}>{p.image}</span>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{p.brand}</div>
                  </div>
                  <div style={{ marginRight: 'auto', fontSize: '0.82rem', fontWeight: 700, color: '#16A34A' }}>₪{Math.min(...Object.values(p.prices))}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low items suggestions */}
        {lowItems.length > 0 && (
          <div className="card fade-in" style={{ marginBottom: '0.75rem', background: '#FEF3C7' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400E', marginBottom: '0.5rem' }}>⚠️ כמעט נגמר — הוסף לרשימה?</div>
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
              {lowItems.slice(0, 4).map(item => (
                <button
                  key={item.id}
                  onClick={() => addToShopping(item.product, 1)}
                  style={{ flexShrink: 0, padding: '0.4rem 0.75rem', borderRadius: 999, border: '1.5px solid #D97706', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: '#D97706', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {item.product.image} {item.product.name} + הוסף
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shopping list */}
        {unchecked.length === 0 && checked.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🛒</div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>הרשימה ריקה</div>
            <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>חפש מוצר למעלה כדי להוסיף</div>
          </div>
        ) : (
          <>
            {Object.entries(groupedUnchecked).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.35rem', paddingRight: '0.25rem' }}>{cat}</div>
                {items.map(item => {
                  const bp = bestPrice(item.product)
                  return (
                    <div
                      key={item.id}
                      className="card fade-in"
                      style={{ marginBottom: '0.4rem', padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <button
                        onClick={() => toggleShoppingItem(item.id)}
                        style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid #D1D5DB', background: 'white', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      />
                      <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{item.product.image}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{item.product.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 600 }}>₪{bp.price} ב{bp.store}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', minWidth: 18, textAlign: 'center' }}>×{item.quantity}</span>
                      </div>
                      <button onClick={() => removeFromShopping(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: '0.9rem' }}>✕</button>
                    </div>
                  )
                })}
              </div>
            ))}

            {checked.length > 0 && (
              <div style={{ marginBottom: '5rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9ca3af', marginBottom: '0.35rem' }}>✓ הושלמו ({checked.length})</div>
                {checked.map(item => (
                  <div
                    key={item.id}
                    className="card"
                    style={{ marginBottom: '0.35rem', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.55 }}
                  >
                    <button
                      onClick={() => toggleShoppingItem(item.id)}
                      style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid #16A34A', background: '#DCFCE7', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A', fontSize: '0.8rem' }}
                    >✓</button>
                    <span style={{ fontSize: '1.2rem' }}>{item.product.image}</span>
                    <span style={{ fontSize: '0.82rem', textDecoration: 'line-through', color: '#6b7280' }}>{item.product.name}</span>
                    <button onClick={() => removeFromShopping(item.id)} style={{ marginRight: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: '0.85rem' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {unchecked.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '5rem', right: '0.75rem', left: '0.75rem',
          maxWidth: 430, margin: '0 auto',
          background: 'linear-gradient(135deg, #16A34A, #0D9488)',
          borderRadius: 16, padding: '0.85rem 1rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 4px 20px rgba(22, 163, 74, 0.4)', zIndex: 40,
        }}>
          <div style={{ color: 'white' }}>
            <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>מחיר מינימלי לסל</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>₪{totalBestPrice.toFixed(2)}</div>
          </div>
          <button
            onClick={() => alert('שיתוף הרשימה...')}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '0.5rem 1rem', color: 'white', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            שתף רשימה 📤
          </button>
        </div>
      )}
    </div>
  )
}
