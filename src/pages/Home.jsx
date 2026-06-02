import { useNavigate } from 'react-router-dom'
import { useFridge } from '../context/FridgeContext'

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000)
}

export default function Home() {
  const nav = useNavigate()
  const { fridgeItems, shoppingList, getExpiringItems, getRecipeSuggestions, totalMonthExpenses } = useFridge()
  const expiring = getExpiringItems()
  const unchecked = shoppingList.filter(i => !i.checked).length
  const topRecipes = getRecipeSuggestions().slice(0, 3)

  const deals = [
    { store: 'רמי לוי', product: 'חלב תנובה 3%', price: '5.20', was: '5.90', save: '0.70', emoji: '🥛' },
    { store: 'אושר עד', product: 'ביצים גדולות', price: '15.90', was: '18.90', save: '3.00', emoji: '🥚' },
    { store: 'חצי חינם', product: 'פסטה ספגטי', price: '7.00', was: '8.90', save: '1.90', emoji: '🍝' },
  ]

  return (
    <div className="page-content">
      <div className="gradient-header" style={{ padding: '1.5rem 1rem 2.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, left: -30, fontSize: 120, opacity: 0.07, pointerEvents: 'none' }}>🧊</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
              FridgeTok 🧊
            </h1>
            <p style={{ margin: '0.2rem 0 0', opacity: 0.85, fontSize: '0.85rem' }}>
              המקרר החכם של ישראל
            </p>
          </div>
          <button
            onClick={() => nav('/stats')}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 12, padding: '0.5rem 0.75rem', color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600, backdropFilter: 'blur(4px)' }}
          >
            📊 סטטיסטיקות
          </button>
        </div>
      </div>

      <div style={{ padding: '0 0.75rem', marginTop: '-1.25rem' }}>
        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div className="card fade-in" style={{ textAlign: 'center', padding: '0.85rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0052CC' }}>{fridgeItems.length}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>מוצרים בבית</div>
          </div>
          <div className="card fade-in" style={{ textAlign: 'center', padding: '0.85rem', background: expiring.length > 0 ? '#FEF3C7' : 'white' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: expiring.length > 0 ? '#D97706' : '#10B981' }}>
              {expiring.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>עומדים לפוג</div>
          </div>
          <div className="card fade-in" style={{ textAlign: 'center', padding: '0.85rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6366F1' }}>{unchecked}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>לרשימת הקניות</div>
          </div>
          <div className="card fade-in" style={{ textAlign: 'center', padding: '0.85rem' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10B981' }}>₪{totalMonthExpenses.toFixed(0)}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>הוצאה החודש</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card fade-in" style={{ marginBottom: '0.75rem', padding: '0.85rem' }}>
          <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.88rem', fontWeight: 700, color: '#374151' }}>⚡ פעולות מהירות</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
            {[
              { label: 'סרוק מוצר', emoji: '📷', path: '/scanner', color: '#EEF2FF', textColor: '#4F46E5' },
              { label: 'הוסף למקרר', emoji: '🧊', path: '/fridge', color: '#E0F2FE', textColor: '#0369A1' },
              { label: 'מצא מתכון', emoji: '🍳', path: '/recipes', color: '#FEF3C7', textColor: '#D97706' },
              { label: 'רשימת קניות', emoji: '🛒', path: '/shopping', color: '#DCFCE7', textColor: '#16A34A' },
            ].map(a => (
              <button
                key={a.path}
                onClick={() => nav(a.path)}
                style={{
                  background: a.color, border: 'none', borderRadius: 12, padding: '0.75rem 0.65rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  color: a.textColor, fontFamily: 'inherit', fontWeight: 700, fontSize: '0.83rem',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{a.emoji}</span> {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recipe Suggestions */}
        <div style={{ marginBottom: '0.75rem' }} className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#374151' }}>🍳 מה לבשל היום?</h3>
            <button onClick={() => nav('/recipes')} style={{ background: 'none', border: 'none', color: '#0052CC', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>כל המתכונים ›</button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {topRecipes.map(r => (
              <div
                key={r.id}
                className="card"
                onClick={() => nav('/recipes')}
                style={{ minWidth: 140, cursor: 'pointer', padding: '0.75rem', flexShrink: 0 }}
              >
                <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '0.25rem' }}>{r.emoji}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.3rem', lineHeight: 1.2 }}>{r.name}</div>
                <div style={{
                  fontSize: '0.68rem', textAlign: 'center', padding: '0.2rem 0.5rem', borderRadius: 999,
                  background: r.missingCount === 0 ? '#DCFCE7' : r.missingCount <= 2 ? '#FEF3C7' : '#FEE2E2',
                  color: r.missingCount === 0 ? '#16A34A' : r.missingCount <= 2 ? '#D97706' : '#DC2626',
                }}>
                  {r.missingCount === 0 ? '✓ יש הכל' : `חסר ${r.missingCount}`}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#9ca3af', textAlign: 'center', marginTop: '0.3rem' }}>⏱ {r.prepTime + r.cookTime} דק׳</div>
              </div>
            ))}
          </div>
        </div>

        {/* Expiring Items */}
        {expiring.length > 0 && (
          <div style={{ marginBottom: '0.75rem' }} className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#374151' }}>⏰ עומדים לפוג</h3>
              <button onClick={() => nav('/fridge')} style={{ background: 'none', border: 'none', color: '#0052CC', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>כולם ›</button>
            </div>
            {expiring.map(item => {
              const days = daysUntil(item.expiryDate)
              return (
                <div
                  key={item.id}
                  className={days <= 1 ? 'expiry-critical' : 'expiry-soon'}
                  style={{ borderRadius: 12, padding: '0.65rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.3rem' }}>{item.product.image}</span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{item.product.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>כמות: {item.quantity}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: days <= 1 ? '#DC2626' : '#D97706' }}>
                    {days <= 0 ? 'פג תוקף!' : days === 1 ? 'מחר!' : `${days} ימים`}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Deals */}
        <div style={{ marginBottom: '0.75rem' }} className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#374151' }}>🏷️ מבצעים השבוע</h3>
            <button onClick={() => nav('/prices')} style={{ background: 'none', border: 'none', color: '#0052CC', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>כל המחירים ›</button>
          </div>
          {deals.map((d, i) => (
            <div key={i} className="card" style={{ marginBottom: '0.4rem', padding: '0.65rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.3rem' }}>{d.emoji}</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{d.product}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{d.store}</div>
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#16A34A' }}>₪{d.price}</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', textDecoration: 'line-through' }}>₪{d.was}</div>
                <div style={{ fontSize: '0.68rem', color: '#DC2626', fontWeight: 700 }}>חסכון ₪{d.save}</div>
              </div>
            </div>
          ))}
        </div>

        {/* TikTok Banner */}
        <div
          className="card fade-in"
          onClick={() => nav('/tiktok')}
          style={{ marginBottom: '0.75rem', cursor: 'pointer', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: 'white', padding: '1rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '2.5rem' }}>🎥</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>TikTok AI</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>הדבק קישור טיקטוק וקבל מתכון מיידי</div>
            </div>
            <span style={{ marginRight: 'auto', fontSize: '1.2rem', opacity: 0.6 }}>›</span>
          </div>
        </div>
      </div>
    </div>
  )
}
