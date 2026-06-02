import { useState, useMemo } from 'react'
import { useFridge } from '../context/FridgeContext'
import { ISRAELI_PRODUCTS, CATEGORIES } from '../data/products'

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000)
}

const LOCATIONS = [
  { id: 'fridge', label: 'מקרר', icon: '🧊' },
  { id: 'pantry', label: 'מזווה', icon: '🗄️' },
  { id: 'freezer', label: 'מקפיא', icon: '❄️' },
]

export default function FridgePage() {
  const { fridgeItems, addToFridge, removeFromFridge, updateQuantity } = useFridge()
  const [activeTab, setActiveTab] = useState('fridge')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('הכל')
  const [sortBy, setSortBy] = useState('name')
  const [showAddModal, setShowAddModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [addQty, setAddQty] = useState(1)
  const [addLocation, setAddLocation] = useState('fridge')
  const [addExpiry, setAddExpiry] = useState('')

  const tabItems = useMemo(() =>
    fridgeItems.filter(i => i.location === activeTab), [fridgeItems, activeTab])

  const filtered = useMemo(() => {
    let items = tabItems.filter(i => {
      const matchSearch = !search || i.product.name.includes(search) || i.product.brand.includes(search)
      const matchCat = activeCategory === 'הכל' || i.product.category === activeCategory
      return matchSearch && matchCat
    })
    switch (sortBy) {
      case 'expiry': return [...items].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
      case 'quantity': return [...items].sort((a, b) => b.quantity - a.quantity)
      default: return [...items].sort((a, b) => a.product.name.localeCompare(b.product.name, 'he'))
    }
  }, [tabItems, search, activeCategory, sortBy])

  const productResults = useMemo(() => {
    if (!productSearch) return ISRAELI_PRODUCTS.slice(0, 8)
    return ISRAELI_PRODUCTS.filter(p =>
      p.name.includes(productSearch) || p.brand.includes(productSearch) || p.barcode.includes(productSearch)
    ).slice(0, 12)
  }, [productSearch])

  function handleAdd() {
    if (!selectedProduct) return
    addToFridge(selectedProduct, addQty, addLocation, addExpiry || null)
    setShowAddModal(false)
    setSelectedProduct(null)
    setProductSearch('')
    setAddQty(1)
    setAddLocation('fridge')
    setAddExpiry('')
  }

  const expiryColor = (dateStr) => {
    const days = daysUntil(dateStr)
    if (days <= 1) return { bg: '#FEE2E2', border: '#EF4444', text: '#DC2626' }
    if (days <= 3) return { bg: '#FEF3C7', border: '#F59E0B', text: '#D97706' }
    return { bg: '#F0FDF4', border: '#86EFAC', text: '#16A34A' }
  }

  return (
    <div className="page-content" style={{ background: '#f0f9ff' }}>
      {/* Header */}
      <div className="gradient-header" style={{ padding: '1.25rem 1rem 1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>🧊 המקרר שלי</h1>
        <p style={{ margin: '0.25rem 0 0', opacity: 0.85, fontSize: '0.82rem' }}>
          {fridgeItems.length} מוצרים בסך הכל
        </p>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex' }}>
        {LOCATIONS.map(loc => {
          const count = fridgeItems.filter(i => i.location === loc.id).length
          return (
            <button
              key={loc.id}
              onClick={() => setActiveTab(loc.id)}
              style={{
                flex: 1, padding: '0.75rem 0.5rem', border: 'none', background: 'none',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                borderBottom: activeTab === loc.id ? '3px solid #0052CC' : '3px solid transparent',
                color: activeTab === loc.id ? '#0052CC' : '#6b7280',
              }}
            >
              {loc.icon} {loc.label}
              {count > 0 && (
                <span style={{
                  marginRight: 4, background: activeTab === loc.id ? '#0052CC' : '#e5e7eb',
                  color: activeTab === loc.id ? 'white' : '#6b7280',
                  borderRadius: 999, padding: '0 5px', fontSize: '0.7rem',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '0.75rem' }}>
        {/* Search and Sort */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            placeholder="🔍 חפש מוצר..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, padding: '0.6rem 0.85rem', border: '1px solid #e5e7eb',
              borderRadius: 12, fontSize: '0.85rem', background: 'white',
            }}
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              padding: '0.6rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: 12,
              fontFamily: 'inherit', fontSize: '0.8rem', background: 'white', cursor: 'pointer',
            }}
          >
            <option value="name">א-ת</option>
            <option value="expiry">תאריך</option>
            <option value="quantity">כמות</option>
          </select>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
          {['הכל', ...new Set(tabItems.map(i => i.product.category))].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="category-pill"
              style={{
                background: activeCategory === cat ? '#0052CC' : 'white',
                color: activeCategory === cat ? 'white' : '#374151',
                border: activeCategory === cat ? '1px solid #0052CC' : '1px solid #e5e7eb',
                flexShrink: 0,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>
              {activeTab === 'fridge' ? '🧊' : activeTab === 'pantry' ? '🗄️' : '❄️'}
            </div>
            <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>
              {search ? 'לא נמצאו מוצרים' : `ה${LOCATIONS.find(l => l.id === activeTab)?.label} ריק`}
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              {search ? 'נסה חיפוש אחר' : 'לחץ + להוסיף מוצר ראשון'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {filtered.map(item => {
              const days = daysUntil(item.expiryDate)
              const colors = expiryColor(item.expiryDate)
              return (
                <div key={item.id} className="card fade-in" style={{ padding: '0.75rem', position: 'relative' }}>
                  {days <= 3 && (
                    <div style={{
                      position: 'absolute', top: 8, left: 8,
                      background: colors.bg, border: `1px solid ${colors.border}`,
                      borderRadius: 999, padding: '1px 6px', fontSize: '0.65rem',
                      fontWeight: 700, color: colors.text,
                    }}>
                      {days <= 0 ? 'פג!' : days === 1 ? 'מחר' : `${days}ד`}
                    </div>
                  )}
                  <button
                    onClick={() => removeFromFridge(item.id)}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.75rem', color: '#d1d5db', padding: 2,
                    }}
                  >✕</button>
                  <div style={{ textAlign: 'center', fontSize: '2.2rem', marginBottom: '0.25rem' }}>
                    {item.product.image}
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.15rem', lineHeight: 1.3 }}>
                    {item.product.name}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', textAlign: 'center', marginBottom: '0.5rem' }}>
                    {item.product.brand}
                  </div>
                  {/* Quantity Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #e5e7eb',
                        background: 'white', cursor: 'pointer', fontSize: '1rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}
                    >−</button>
                    <span style={{ fontWeight: 800, fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #0052CC',
                        background: '#EEF2FF', cursor: 'pointer', fontSize: '1rem', fontWeight: 700,
                        color: '#0052CC', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}
                    >+</button>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', textAlign: 'center', marginTop: '0.35rem' }}>
                    {new Date(item.expiryDate).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          position: 'fixed', bottom: '5.5rem', left: '1.25rem',
          width: 54, height: 54, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0052CC, #0099B0)',
          border: 'none', color: 'white', fontSize: '1.5rem',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,82,204,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 40,
        }}
      >+</button>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>הוסף מוצר</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#6b7280' }}>✕</button>
            </div>

            {!selectedProduct ? (
              <>
                <input
                  type="text"
                  placeholder="🔍 חפש מוצר לפי שם, מותג או ברקוד..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '0.7rem 0.9rem', border: '1px solid #e5e7eb',
                    borderRadius: 12, fontSize: '0.9rem', marginBottom: '0.75rem', boxSizing: 'border-box',
                  }}
                  autoFocus
                />
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {productResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem',
                        borderRadius: 10, cursor: 'pointer', marginBottom: '0.3rem',
                        border: '1px solid #f3f4f6', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >
                      <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{p.image}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{p.brand} · {p.category}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f0f9ff', borderRadius: 12, padding: '0.75rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>{selectedProduct.image}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{selectedProduct.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{selectedProduct.brand}</div>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} style={{ marginRight: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.85rem' }}>שנה</button>
                </div>

                {/* Location */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>מיקום</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {LOCATIONS.map(loc => (
                      <button
                        key={loc.id}
                        onClick={() => setAddLocation(loc.id)}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: 10, cursor: 'pointer',
                          border: addLocation === loc.id ? '2px solid #0052CC' : '1px solid #e5e7eb',
                          background: addLocation === loc.id ? '#EEF2FF' : 'white',
                          fontFamily: 'inherit', fontWeight: 600, fontSize: '0.8rem',
                          color: addLocation === loc.id ? '#0052CC' : '#374151',
                        }}
                      >
                        {loc.icon} {loc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>כמות</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setAddQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>−</button>
                    <span style={{ fontWeight: 800, fontSize: '1.2rem', minWidth: 24, textAlign: 'center' }}>{addQty}</span>
                    <button onClick={() => setAddQty(q => q + 1)} style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #0052CC', background: '#EEF2FF', cursor: 'pointer', fontSize: '1.2rem', color: '#0052CC' }}>+</button>
                  </div>
                </div>

                {/* Expiry */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>תאריך תפוגה (אופציונלי)</label>
                  <input
                    type="date"
                    value={addExpiry}
                    onChange={e => setAddExpiry(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 0.85rem', border: '1px solid #e5e7eb',
                      borderRadius: 12, fontFamily: 'inherit', fontSize: '0.85rem', boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button
                  onClick={handleAdd}
                  style={{
                    width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, #0052CC, #0099B0)',
                    border: 'none', borderRadius: 14, color: 'white', fontFamily: 'inherit',
                    fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                  }}
                >
                  הוסף למקרר ✓
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
