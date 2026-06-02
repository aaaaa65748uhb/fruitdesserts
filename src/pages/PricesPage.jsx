import { useState, useMemo } from 'react'
import { ISRAELI_PRODUCTS } from '../data/products'
import { STORES } from '../data/stores'
import { useFridge } from '../context/FridgeContext'

const POPULAR = ['חלב תנובה 3%', 'ביצים גדולות', 'לחם אחיד פרוס', 'גבינה לבנה 5%', 'פסטה ספגטי']

export default function PricesPage() {
  const { addToShopping } = useFridge()
  const [search, setSearch] = useState('')
  const [basket, setBasket] = useState([])
  const [tab, setTab] = useState('compare')

  const results = useMemo(() => {
    if (!search) return []
    return ISRAELI_PRODUCTS.filter(p => p.name.includes(search) || p.brand.includes(search)).slice(0, 5)
  }, [search])

  const popularResults = useMemo(() => {
    return POPULAR.map(name => ISRAELI_PRODUCTS.find(p => p.name === name)).filter(Boolean)
  }, [])

  function addToBasket(product) {
    if (!basket.find(b => b.id === product.id)) {
      setBasket(prev => [...prev, product])
    }
  }

  const basketTotals = useMemo(() => {
    return STORES.map(store => ({
      ...store,
      total: basket.reduce((sum, p) => sum + (p.prices[store.id] || 0), 0),
    })).sort((a, b) => a.total - b.total)
  }, [basket])

  function renderPriceRow(product) {
    const prices = Object.entries(product.prices)
    const min = Math.min(...prices.map(([, v]) => v))
    const max = Math.max(...prices.map(([, v]) => v))
    return (
      <div key={product.id} className="card fade-in" style={{ marginBottom: '0.5rem', padding: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.65rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{product.image}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{product.name}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{product.brand} · {product.weight}{product.unit}</div>
          </div>
          <div style={{ marginRight: 'auto', display: 'flex', gap: '0.35rem' }}>
            <button
              onClick={() => addToBasket(product)}
              style={{ padding: '0.3rem 0.6rem', borderRadius: 8, border: '1.5px solid #0052CC', background: 'white', color: '#0052CC', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
            >+ סל</button>
            <button
              onClick={() => { const min2 = Object.entries(product.prices).reduce((a, b) => b[1] < product.prices[a] ? b[0] : a, Object.keys(product.prices)[0]); addToShopping(product, 1, `ב${STORES.find(s=>s.id===min2)?.name}`) }}
              style={{ padding: '0.3rem 0.6rem', borderRadius: 8, border: '1.5px solid #16A34A', background: 'white', color: '#16A34A', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
            >🛒</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
          {STORES.slice(0, 4).map(store => {
            const price = product.prices[store.id]
            const isBest = price === min
            const isWorst = price === max
            return (
              <div key={store.id} style={{
                textAlign: 'center', padding: '0.4rem 0.2rem', borderRadius: 8,
                background: isBest ? '#DCFCE7' : isWorst ? '#FEE2E2' : '#F9FAFB',
                border: isBest ? '1.5px solid #16A34A' : isWorst ? '1.5px solid #EF4444' : '1px solid #F3F4F6',
              }}>
                <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '0.15rem' }}>{store.name}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: isBest ? '#16A34A' : isWorst ? '#DC2626' : '#374151' }}>₪{price}</div>
                {isBest && <div style={{ fontSize: '0.6rem', color: '#16A34A', fontWeight: 700 }}>הכי זול!</div>}
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.4rem', textAlign: 'center' }}>
          חסכון מקסימלי: <span style={{ color: '#16A34A', fontWeight: 700 }}>₪{(max - min).toFixed(2)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="gradient-header" style={{ padding: '1rem 1rem 1.5rem', background: 'linear-gradient(135deg, #7C3AED, #0052CC)' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>💰 השוואת מחירים</h1>
        <p style={{ margin: '0.25rem 0 0', opacity: 0.85, fontSize: '0.82rem' }}>8 רשתות מזון בישראל</p>
      </div>

      <div style={{ padding: '0 0.75rem', marginTop: '-0.75rem' }}>
        {/* Tabs */}
        <div className="card" style={{ padding: '0.35rem', marginBottom: '0.65rem', display: 'flex', gap: '0.25rem' }}>
          {[['compare', '📊 השוואה'], ['basket', `🛒 סל (${basket.length})`]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, padding: '0.55rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 700, fontSize: '0.82rem',
              background: tab === id ? 'linear-gradient(135deg, #7C3AED, #0052CC)' : 'transparent',
              color: tab === id ? 'white' : '#6b7280',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'compare' && (
          <>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 חפש מוצר להשוואה..."
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 12, border: '1.5px solid #E5E7EB', fontSize: '0.88rem', marginBottom: '0.75rem', background: 'white' }}
            />

            {search ? (
              results.length > 0 ? results.map(renderPriceRow) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  <div>לא נמצאו מוצרים</div>
                </div>
              )
            ) : (
              <>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>🔥 מוצרים פופולריים</div>
                {popularResults.map(renderPriceRow)}
              </>
            )}
          </>
        )}

        {tab === 'basket' && (
          <>
            {basket.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🛒</div>
                <div style={{ fontWeight: 700 }}>הסל ריק</div>
                <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>הוסף מוצרים בלשונית "השוואה"</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>מוצרים בסל ({basket.length})</div>
                {basket.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem', background: 'white', borderRadius: 10, marginBottom: '0.35rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <span style={{ fontSize: '1.3rem' }}>{p.image}</span>
                    <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600 }}>{p.name}</span>
                    <button onClick={() => setBasket(b => b.filter(x => x.id !== p.id))} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                  </div>
                ))}

                <div style={{ marginTop: '0.75rem', fontSize: '0.88rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
                  🏆 אן הכי זול לקנות את הסל?
                </div>
                {basketTotals.filter(s => s.total > 0).map((store, i) => (
                  <div
                    key={store.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 0.85rem',
                      borderRadius: 12, marginBottom: '0.4rem',
                      background: i === 0 ? '#DCFCE7' : 'white',
                      border: i === 0 ? '1.5px solid #16A34A' : '1px solid #F3F4F6',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{store.logo}</span>
                    <span style={{ flex: 1, fontWeight: i === 0 ? 700 : 500, fontSize: '0.88rem' }}>
                      {store.name} {i === 0 && '🏆'}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: i === 0 ? '#16A34A' : '#374151' }}>
                      ₪{store.total.toFixed(2)}
                    </span>
                    {i === 0 && (
                      <span style={{ fontSize: '0.7rem', color: '#16A34A', fontWeight: 700 }}>
                        חסכון ₪{(basketTotals[basketTotals.length - 1].total - store.total).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        <div style={{ height: '5rem' }} />
      </div>

      <div style={{ position: 'fixed', bottom: '4.5rem', right: 0, left: 0, padding: '0.4rem 0.75rem', background: 'white', borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
        <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>עדכון אחרון: היום · מקור: שקיפות מחירים ממשלת ישראל</div>
      </div>
    </div>
  )
}
