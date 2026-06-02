import { useState, useMemo } from 'react'
import { useFridge } from '../context/FridgeContext'
import { RECIPES } from '../data/recipes'
import { ISRAELI_PRODUCTS } from '../data/products'

function RecipeModal({ recipe, onClose, onAddMissing }) {
  const [step, setStep] = useState(0)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxHeight: '90vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '2rem' }}>{recipe.emoji}</div>
            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: 800 }}>{recipe.name}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {[`⏱ ${recipe.prepTime + recipe.cookTime} דק׳`, `👥 ${recipe.servings} מנות`, `📊 ${['קל', 'בינוני', 'מתקדם'][recipe.difficulty - 1]}`].map(t => (
            <span key={t} style={{ background: '#F3F4F6', borderRadius: 999, padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 600 }}>{t}</span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {['מרכיבים', 'הוראות', 'תזונה'].map((tab, i) => (
            <button key={tab} onClick={() => setStep(i)} style={{
              flex: 1, padding: '0.45rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600, fontSize: '0.8rem',
              background: step === i ? '#0052CC' : '#F3F4F6',
              color: step === i ? 'white' : '#374151',
            }}>{tab}</button>
          ))}
        </div>

        {step === 0 && (
          <div>
            {recipe.ingredients.map((ing, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{ing.name}</span>
                <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{ing.amount} {ing.unit}</span>
              </div>
            ))}
            {recipe.missing?.length > 0 && (
              <button
                onClick={() => { onAddMissing(recipe); onClose() }}
                style={{ width: '100%', marginTop: '0.75rem', padding: '0.75rem', borderRadius: 12, border: 'none', background: '#DCFCE7', color: '#16A34A', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
              >
                🛒 הוסף {recipe.missingCount} חסרים לרשימת קניות
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <ol style={{ margin: 0, padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {recipe.instructions.map((inst, i) => (
              <li key={i} style={{ fontSize: '0.85rem', lineHeight: 1.55, color: '#374151' }}>{inst}</li>
            ))}
          </ol>
        )}

        {step === 2 && recipe.nutrition && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {[['🔥 קלוריות', recipe.nutrition.calories, ''], ['💪 חלבון', recipe.nutrition.protein, 'ג'], ['🌾 פחמימות', recipe.nutrition.carbs, 'ג'], ['🥑 שומן', recipe.nutrition.fat, 'ג']].map(([label, val, unit]) => (
              <div key={label} style={{ background: '#F9FAFB', borderRadius: 12, padding: '0.85rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{val}{unit}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RecipesPage() {
  const { getRecipeSuggestions, addToShopping } = useFridge()
  const [tab, setTab] = useState('ai')
  const [search, setSearch] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [category, setCategory] = useState('הכל')

  const suggestions = getRecipeSuggestions()

  const filtered = useMemo(() => {
    const base = tab === 'ai' ? suggestions : RECIPES.map(r => ({ ...r, missingCount: 0, missing: [] }))
    return base.filter(r => {
      if (search && !r.name.includes(search)) return false
      if (category !== 'הכל' && r.category !== category) return false
      return true
    })
  }, [tab, suggestions, search, category])

  function handleAddMissing(recipe) {
    if (!recipe.missing) return
    recipe.missing.forEach(ing => {
      if (ing.productId) {
        const p = ISRAELI_PRODUCTS.find(p => p.id === ing.productId)
        if (p) addToShopping(p, Math.ceil(ing.amount / 100) || 1)
      }
    })
  }

  const categories = ['הכל', 'ארוחת בוקר', 'ארוחת ערב', 'סלטים', 'קינוח', 'ממרחים']

  return (
    <div className="page-content">
      <div className="gradient-header" style={{ padding: '1rem 1rem 1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>🍳 Fridge Chef AI</h1>
        <p style={{ margin: '0.25rem 0 0', opacity: 0.85, fontSize: '0.82rem' }}>מתכונים לפי מה שיש לך</p>
      </div>

      <div style={{ padding: '0 0.75rem', marginTop: '-0.75rem' }}>
        {/* Tabs */}
        <div className="card" style={{ padding: '0.35rem', marginBottom: '0.65rem', display: 'flex', gap: '0.25rem' }}>
          {[['ai', '🤖 הצעות AI'], ['all', '📖 כל המתכונים']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, padding: '0.55rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 700, fontSize: '0.82rem',
              background: tab === id ? 'linear-gradient(135deg, #FF6B6B, #FF8E53)' : 'transparent',
              color: tab === id ? 'white' : '#6b7280',
            }}>{label}</button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 חפש מתכון..."
          style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 12, border: '1.5px solid #E5E7EB', fontSize: '0.88rem', marginBottom: '0.5rem', background: 'white' }}
        />

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem', marginBottom: '0.75rem' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className="category-pill" style={{
              background: category === cat ? '#FF6B6B' : 'white',
              color: category === cat ? 'white' : '#374151',
              border: `1.5px solid ${category === cat ? '#FF6B6B' : '#E5E7EB'}`,
              flexShrink: 0,
            }}>{cat}</button>
          ))}
        </div>

        {/* Fridge summary for AI tab */}
        {tab === 'ai' && (
          <div className="card fade-in" style={{ marginBottom: '0.75rem', background: '#FEF3C7', padding: '0.75rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400E', marginBottom: '0.35rem' }}>🧊 זיהוי מרכיבים אוטומטי</div>
            <div style={{ fontSize: '0.78rem', color: '#78350F' }}>
              מצאתי {suggestions.filter(r => r.missingCount === 0).length} מתכונים שאפשר להכין עכשיו
              ו-{suggestions.filter(r => r.missingCount > 0 && r.missingCount <= 2).length} מתכונים שחסרים 1-2 מרכיבים
            </div>
          </div>
        )}

        {/* Recipe Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '5rem' }}>
          {filtered.map(recipe => {
            const canMake = !recipe.missingCount || recipe.missingCount === 0
            const almostCanMake = recipe.missingCount <= 2 && recipe.missingCount > 0
            return (
              <div
                key={recipe.id}
                className="card fade-in"
                onClick={() => setSelectedRecipe(recipe)}
                style={{
                  padding: '0.85rem', cursor: 'pointer',
                  borderRight: `4px solid ${canMake ? '#16A34A' : almostCanMake ? '#D97706' : '#E5E7EB'}`,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '2rem', flexShrink: 0 }}>{recipe.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.2rem' }}>{recipe.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.4rem' }}>{recipe.description}</div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>⏱ {recipe.prepTime + recipe.cookTime} דק׳</span>
                      <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>👥 {recipe.servings}</span>
                      <span style={{ fontSize: '0.72rem' }}>{'⭐'.repeat(recipe.difficulty)}</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'center' }}>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: 999,
                      background: canMake ? '#DCFCE7' : almostCanMake ? '#FEF3C7' : '#F3F4F6',
                      color: canMake ? '#16A34A' : almostCanMake ? '#D97706' : '#6b7280',
                    }}>
                      {canMake ? '✓ יש הכל' : `חסר ${recipe.missingCount}`}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onAddMissing={handleAddMissing}
        />
      )}
    </div>
  )
}
