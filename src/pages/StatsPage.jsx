import { useNavigate } from 'react-router-dom'
import { useFridge } from '../context/FridgeContext'
import { STORES } from '../data/stores'

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

const WEEKLY_DATA = [
  { week: 'שבוע 1', amount: 187.5 },
  { week: 'שבוע 2', amount: 142.3 },
  { week: 'שבוע 3', amount: 215.8 },
  { week: 'שבוע 4', amount: 98.4 },
]

const CATEGORIES_DATA = [
  { name: 'בשר ועוף', percent: 28, color: '#EF4444', emoji: '🥩' },
  { name: 'ירקות ופירות', percent: 22, color: '#22C55E', emoji: '🥦' },
  { name: 'חלב וגבינות', percent: 18, color: '#3B82F6', emoji: '🥛' },
  { name: 'לחם ומאפים', percent: 12, color: '#F59E0B', emoji: '🍞' },
  { name: 'שימורים', percent: 10, color: '#8B5CF6', emoji: '🥫' },
  { name: 'אחר', percent: 10, color: '#6B7280', emoji: '📦' },
]

const TOP_PRODUCTS = [
  { name: 'חלב תנובה 3%', count: 8, emoji: '🥛' },
  { name: 'ביצים גדולות', count: 6, emoji: '🥚' },
  { name: 'לחם אחיד', count: 5, emoji: '🍞' },
  { name: 'גבינה לבנה', count: 4, emoji: '🧀' },
  { name: 'עגבניות שרי', count: 4, emoji: '🍅' },
]

export default function StatsPage() {
  const nav = useNavigate()
  const { expenses, totalMonthExpenses, fridgeItems } = useFridge()
  const now = new Date()
  const thisMonth = MONTHS[now.getMonth()]

  const maxWeekly = Math.max(...WEEKLY_DATA.map(w => w.amount))
  const prevMonthTotal = 780
  const savings = prevMonthTotal - totalMonthExpenses

  const bestStore = STORES.find(s => s.id === 'ramiLevy')

  return (
    <div className="page-content">
      <div className="gradient-header" style={{ padding: '1rem 1rem 1.5rem', background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
          <button onClick={() => nav(-1)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '0.35rem 0.6rem', color: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>‹</button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>📊 סטטיסטיקות</h1>
            <p style={{ margin: '0.1rem 0 0', opacity: 0.8, fontSize: '0.78rem' }}>{thisMonth} {now.getFullYear()}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 0.75rem', marginTop: '-0.75rem' }}>
        {/* Hero */}
        <div className="card fade-in" style={{ marginBottom: '0.65rem', background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)', color: 'white', textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.85, marginBottom: '0.25rem' }}>הוצאת ב{thisMonth}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-1px' }}>₪{totalMonthExpenses.toFixed(0)}</div>
          <div style={{
            display: 'inline-block', marginTop: '0.5rem', padding: '0.3rem 0.85rem', borderRadius: 999,
            background: savings > 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
            color: savings > 0 ? '#86EFAC' : '#FCA5A5', fontSize: '0.82rem', fontWeight: 700,
          }}>
            {savings > 0 ? `חסכת ₪${savings.toFixed(0)} לעומת חודש שעבר` : `הוצאת ₪${Math.abs(savings).toFixed(0)} יותר`}
          </div>
        </div>

        {/* Weekly chart */}
        <div className="card fade-in" style={{ marginBottom: '0.65rem', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: '0.65rem' }}>הוצאות שבועיות</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: 100 }}>
            {WEEKLY_DATA.map((w, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 600 }}>₪{w.amount.toFixed(0)}</div>
                <div style={{
                  width: '100%', borderRadius: '6px 6px 0 0',
                  height: `${(w.amount / maxWeekly) * 70}px`,
                  background: `linear-gradient(180deg, #7C3AED, #1D4ED8)`,
                  transition: 'height 0.5s ease',
                }} />
                <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{w.week}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="card fade-in" style={{ marginBottom: '0.65rem', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: '0.65rem' }}>פילוח לפי קטגוריה</div>
          {CATEGORIES_DATA.map(cat => (
            <div key={cat.name} style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{cat.emoji} {cat.name}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: cat.color }}>{cat.percent}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${cat.percent}%`, background: cat.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Best store */}
        <div className="card fade-in" style={{ marginBottom: '0.65rem', padding: '0.85rem', background: '#DCFCE7' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#14532D', marginBottom: '0.5rem' }}>🏆 הרשת הכי משתלמת עבורך</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '2rem' }}>{bestStore?.logo}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#15803D' }}>{bestStore?.name}</div>
              <div style={{ fontSize: '0.78rem', color: '#166534' }}>חסכת ₪{Math.round(savings * 0.6)} השנה על ידי קניה שם</div>
            </div>
          </div>
        </div>

        {/* Top products */}
        <div className="card fade-in" style={{ marginBottom: '0.65rem', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: '0.6rem' }}>🛒 מוצרים שקנית הכי הרבה</div>
          {TOP_PRODUCTS.map((p, i) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.45rem 0', borderBottom: i < TOP_PRODUCTS.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#9ca3af', minWidth: 14 }}>{i + 1}</span>
              <span style={{ fontSize: '1.2rem' }}>{p.emoji}</span>
              <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</span>
              <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 }}>×{p.count}</span>
            </div>
          ))}
        </div>

        {/* AI Tip */}
        <div className="card fade-in" style={{ marginBottom: '5rem', padding: '0.85rem', background: '#FEF3C7', border: '1px solid #FCD34D' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400E', marginBottom: '0.4rem' }}>💡 טיפ לחיסכון מה-AI</div>
          <div style={{ fontSize: '0.82rem', color: '#78350F', lineHeight: 1.55 }}>
            אם תקנה בשר ועוף ברמי לוי במקום בשופרסל, תחסוך כ-₪80 בחודש.
            בנוסף, קניה בכמות גדולה של חלב ולחם חוסכת עד 15% על מוצרים בסיסיים.
          </div>
        </div>
      </div>
    </div>
  )
}
