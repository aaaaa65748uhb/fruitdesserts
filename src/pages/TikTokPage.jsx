import { useState } from 'react'
import { useFridge } from '../context/FridgeContext'
import { ISRAELI_PRODUCTS } from '../data/products'

const DEMO_VIDEOS = [
  {
    id: 1, title: 'שקשוקה מטורפת של אמא שלי', duration: '0:45', views: '2.3M', emoji: '🍳',
    color: '#FF6B6B',
    result: {
      name: 'שקשוקה מסורתית', prepTime: 5, cookTime: 20,
      ingredients: [
        { name: 'ביצים', amount: '4', unit: 'יחידות' },
        { name: 'עגבניות', amount: '400', unit: 'גרם' },
        { name: 'פלפל אדום', amount: '1', unit: 'יחידה' },
        { name: 'שום', amount: '3', unit: 'שיניים' },
        { name: 'שמן זית', amount: '3', unit: 'כפות' },
        { name: 'פפריקה', amount: '1', unit: 'כפית' },
      ],
      steps: ['מחממים שמן ומטגנים שום ופלפל', 'מוסיפים עגבניות ומבשלים 10 דקות', 'שוברים ביצים לתוך הרוטב', 'מבשלים 8 דקות ומגישים'],
      nutrition: { calories: 280, protein: 18, carbs: 12, fat: 18 },
    },
  },
  {
    id: 2, title: 'פסטה ב-10 דקות שכולם משתגעים עליה', duration: '1:02', views: '1.8M', emoji: '🍝',
    color: '#FF8E53',
    result: {
      name: 'פסטה שמנת פטריות', prepTime: 5, cookTime: 15,
      ingredients: [
        { name: 'פסטה פנה', amount: '400', unit: 'גרם' },
        { name: 'שמנת מתוקה', amount: '200', unit: 'מ"ל' },
        { name: 'פטריות', amount: '200', unit: 'גרם' },
        { name: 'גבינה מגוררת', amount: '80', unit: 'גרם' },
        { name: 'שום', amount: '2', unit: 'שיניים' },
      ],
      steps: ['מבשלים פסטה', 'מטגנים פטריות ושום', 'מוסיפים שמנת וגבינה', 'מערבבים עם פסטה'],
      nutrition: { calories: 480, protein: 16, carbs: 58, fat: 22 },
    },
  },
  {
    id: 3, title: 'עוגת שוקולד ב-3 מרכיבים בלבד', duration: '0:38', views: '4.1M', emoji: '🎂',
    color: '#4F46E5',
    result: {
      name: 'עוגת שוקולד 3 מרכיבים', prepTime: 10, cookTime: 30,
      ingredients: [
        { name: 'שוקולד מריר', amount: '200', unit: 'גרם' },
        { name: 'ביצים', amount: '4', unit: 'יחידות' },
        { name: 'סוכר', amount: '150', unit: 'גרם' },
      ],
      steps: ['ממיסים שוקולד', 'מקציפים ביצים וסוכר', 'מאחדים ואופים 30 דקות ב-180°'],
      nutrition: { calories: 420, protein: 7, carbs: 48, fat: 24 },
    },
  },
]

export default function TikTokPage() {
  const { addToShopping } = useFridge()
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [analyzed, setAnalyzed] = useState(null)

  function analyze(demo) {
    setAnalyzing(true)
    setResult(null)
    setTimeout(() => {
      setAnalyzing(false)
      const r = demo?.result || DEMO_VIDEOS[0].result
      setResult(r)
      setAnalyzed(demo)
    }, 2000)
  }

  function addAllToShopping() {
    if (!result) return
    result.ingredients.forEach(ing => {
      const product = ISRAELI_PRODUCTS.find(p => p.name.includes(ing.name.split(' ')[0]))
      if (product) addToShopping(product, 1)
    })
    alert('המרכיבים נוספו לרשימת הקניות!')
  }

  return (
    <div className="page-content">
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', padding: '1.25rem 1rem 1.5rem', color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>🎥 TikTok AI</h1>
        <p style={{ margin: '0.25rem 0 0', opacity: 0.75, fontSize: '0.82rem' }}>זהה מתכונים מסרטוני טיקטוק</p>
      </div>

      <div style={{ padding: '0 0.75rem', marginTop: '-0.75rem' }}>
        {/* URL Input */}
        <div className="card fade-in" style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>הדבק קישור טיקטוק</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://tiktok.com/@..."
              style={{ flex: 1, padding: '0.65rem', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: '0.88rem' }}
            />
            <button
              onClick={() => url && analyze(null)}
              disabled={!url || analyzing}
              style={{
                padding: '0.65rem 1rem', borderRadius: 10, border: 'none',
                background: url ? 'linear-gradient(135deg, #1a1a2e, #4F46E5)' : '#E5E7EB',
                color: url ? 'white' : '#9ca3af',
                fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', cursor: url ? 'pointer' : 'not-allowed',
              }}
            >נתח</button>
          </div>
          <div style={{ textAlign: 'center', margin: '0.5rem 0', fontSize: '0.78rem', color: '#9ca3af' }}>— או —</div>
          <button style={{ width: '100%', padding: '0.65rem', borderRadius: 10, border: '1.5px dashed #D1D5DB', background: '#F9FAFB', fontFamily: 'inherit', fontSize: '0.85rem', cursor: 'pointer', color: '#374151' }}>
            📁 העלה סרטון מהמכשיר
          </button>
        </div>

        {/* Loading */}
        {analyzing && (
          <div className="card fade-in" style={{ marginBottom: '0.75rem', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🤖</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.35rem' }}>AI מנתח את הסרטון...</div>
            <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>מזהה מרכיבים, כמויות והוראות</div>
          </div>
        )}

        {/* Result */}
        {result && !analyzing && (
          <div className="card slide-up" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: analyzed?.color || '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>{analyzed?.emoji || '🍳'}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{result.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>⏱ {result.prepTime + result.cookTime} דקות · 🔥 {result.nutrition.calories} קל׳</div>
              </div>
              <span style={{ marginRight: 'auto', background: '#DCFCE7', color: '#16A34A', fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: 999 }}>✓ זוהה</span>
            </div>

            <div style={{ marginBottom: '0.65rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>מרכיבים ({result.ingredients.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {result.ingredients.map((ing, i) => (
                  <span key={i} style={{ background: '#F3F4F6', borderRadius: 999, padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 500 }}>
                    {ing.name} · {ing.amount} {ing.unit}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>הוראות הכנה</div>
              <ol style={{ margin: 0, padding: '0 1.25rem' }}>
                {result.steps.map((s, i) => (
                  <li key={i} style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.3rem', lineHeight: 1.5 }}>{s}</li>
                ))}
              </ol>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem', marginBottom: '0.75rem' }}>
              {[['קלוריות', result.nutrition.calories, ''], ['חלבון', result.nutrition.protein, 'ג'], ['פחמימות', result.nutrition.carbs, 'ג'], ['שומן', result.nutrition.fat, 'ג']].map(([l, v, u]) => (
                <div key={l} style={{ background: '#F9FAFB', borderRadius: 8, padding: '0.4rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{v}{u}</div>
                  <div style={{ fontSize: '0.62rem', color: '#6b7280' }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={addAllToShopping} style={{ flex: 1, padding: '0.65rem', borderRadius: 10, border: 'none', background: '#DCFCE7', color: '#16A34A', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                🛒 הוסף מרכיבים לקניות
              </button>
              <button style={{ flex: 1, padding: '0.65rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1a1a2e, #4F46E5)', color: 'white', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                💾 שמור מתכון
              </button>
            </div>
          </div>
        )}

        {/* Demo Videos */}
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>🔥 נסה עם דוגמאות</div>
          {DEMO_VIDEOS.map(video => (
            <div
              key={video.id}
              className="card fade-in"
              onClick={() => analyze(video)}
              style={{ marginBottom: '0.5rem', padding: '0.75rem', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}
            >
              <div style={{
                width: 60, height: 60, borderRadius: 12, background: video.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', flexShrink: 0,
              }}>
                {video.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.2rem' }}>{video.title}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>⏱ {video.duration} · 👁 {video.views} צפיות</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); analyze(video) }}
                style={{
                  padding: '0.4rem 0.75rem', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #1a1a2e, #4F46E5)',
                  color: 'white', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
                }}
              >נתח</button>
            </div>
          ))}
        </div>

        <div style={{ height: '5rem' }} />
      </div>
    </div>
  )
}
