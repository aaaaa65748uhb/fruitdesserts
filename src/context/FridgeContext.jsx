import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ISRAELI_PRODUCTS } from '../data/products'
import { RECIPES } from '../data/recipes'

const FridgeContext = createContext(null)

const INITIAL_FRIDGE = [
  { id: 'f1', productId: '1', product: ISRAELI_PRODUCTS[0], quantity: 2, addedDate: new Date(Date.now() - 86400000*2).toISOString(), expiryDate: new Date(Date.now() + 86400000*4).toISOString(), location: 'fridge' },
  { id: 'f2', productId: '3', product: ISRAELI_PRODUCTS[2], quantity: 12, addedDate: new Date(Date.now() - 86400000).toISOString(), expiryDate: new Date(Date.now() + 86400000*8).toISOString(), location: 'fridge' },
  { id: 'f3', productId: '8', product: ISRAELI_PRODUCTS[7], quantity: 1, addedDate: new Date(Date.now() - 86400000*3).toISOString(), expiryDate: new Date(Date.now() + 86400000*1).toISOString(), location: 'fridge' },
  { id: 'f4', productId: '9', product: ISRAELI_PRODUCTS[8], quantity: 3, addedDate: new Date(Date.now() - 86400000).toISOString(), expiryDate: new Date(Date.now() + 86400000*5).toISOString(), location: 'fridge' },
  { id: 'f5', productId: '10', product: ISRAELI_PRODUCTS[9], quantity: 1, addedDate: new Date(Date.now() - 86400000*5).toISOString(), expiryDate: new Date(Date.now() + 86400000*2).toISOString(), location: 'fridge' },
  { id: 'f6', productId: '2', product: ISRAELI_PRODUCTS[1], quantity: 1, addedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000*10).toISOString(), location: 'fridge' },
  { id: 'f7', productId: '6', product: ISRAELI_PRODUCTS[5], quantity: 2, addedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000*365).toISOString(), location: 'pantry' },
  { id: 'f8', productId: '7', product: ISRAELI_PRODUCTS[6], quantity: 1, addedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000*365).toISOString(), location: 'pantry' },
  { id: 'f9', productId: '5', product: ISRAELI_PRODUCTS[4], quantity: 1, addedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000*180).toISOString(), location: 'pantry' },
  { id: 'f10', productId: '24', product: ISRAELI_PRODUCTS[23], quantity: 1, addedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000*200).toISOString(), location: 'pantry' },
  { id: 'f11', productId: '37', product: ISRAELI_PRODUCTS[36], quantity: 2, addedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000*90).toISOString(), location: 'freezer' },
  { id: 'f12', productId: '38', product: ISRAELI_PRODUCTS[37], quantity: 1, addedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000*60).toISOString(), location: 'freezer' },
  { id: 'f13', productId: '29', product: ISRAELI_PRODUCTS[28], quantity: 2, addedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000*14).toISOString(), location: 'pantry' },
  { id: 'f14', productId: '30', product: ISRAELI_PRODUCTS[29], quantity: 1, addedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000*30).toISOString(), location: 'pantry' },
]

const INITIAL_SHOPPING = [
  { id: 's1', productId: '4', product: ISRAELI_PRODUCTS[3], quantity: 1, checked: false, priority: 'high', note: 'לארוחת בוקר' },
  { id: 's2', productId: '11', product: ISRAELI_PRODUCTS[10], quantity: 1, checked: false, priority: 'high', note: '' },
  { id: 's3', productId: '21', product: ISRAELI_PRODUCTS[20], quantity: 2, checked: false, priority: 'medium', note: 'למילוי' },
  { id: 's4', productId: '17', product: ISRAELI_PRODUCTS[16], quantity: 1, checked: true, priority: 'low', note: '' },
  { id: 's5', productId: '34', product: ISRAELI_PRODUCTS[33], quantity: 4, checked: false, priority: 'medium', note: '' },
]

const INITIAL_EXPENSES = [
  { id: 'e1', date: new Date(Date.now() - 86400000*2).toISOString(), store: 'שופרסל', total: 187.50, items: 12 },
  { id: 'e2', date: new Date(Date.now() - 86400000*5).toISOString(), store: 'רמי לוי', total: 142.30, items: 8 },
  { id: 'e3', date: new Date(Date.now() - 86400000*10).toISOString(), store: 'יוחננוף', total: 215.80, items: 15 },
  { id: 'e4', date: new Date(Date.now() - 86400000*14).toISOString(), store: 'שופרסל', total: 98.40, items: 6 },
]

export function FridgeProvider({ children }) {
  const [fridgeItems, setFridgeItems] = useState(() => {
    try {
      const saved = localStorage.getItem('fridgetok_fridge')
      return saved ? JSON.parse(saved) : INITIAL_FRIDGE
    } catch { return INITIAL_FRIDGE }
  })

  const [shoppingList, setShoppingList] = useState(() => {
    try {
      const saved = localStorage.getItem('fridgetok_shopping')
      return saved ? JSON.parse(saved) : INITIAL_SHOPPING
    } catch { return INITIAL_SHOPPING }
  })

  const [expenses, setExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem('fridgetok_expenses')
      return saved ? JSON.parse(saved) : INITIAL_EXPENSES
    } catch { return INITIAL_EXPENSES }
  })

  const [notifications, setNotifications] = useState([])
  const [savedRecipes, setSavedRecipes] = useState([])

  useEffect(() => {
    localStorage.setItem('fridgetok_fridge', JSON.stringify(fridgeItems))
  }, [fridgeItems])

  useEffect(() => {
    localStorage.setItem('fridgetok_shopping', JSON.stringify(shoppingList))
  }, [shoppingList])

  useEffect(() => {
    localStorage.setItem('fridgetok_expenses', JSON.stringify(expenses))
  }, [expenses])

  const addToFridge = useCallback((product, quantity = 1, location = 'fridge', expiryDate = null) => {
    const existing = fridgeItems.find(i => i.productId === product.id && i.location === location)
    if (existing) {
      setFridgeItems(prev => prev.map(i =>
        i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i
      ))
    } else {
      const defaultExpiry = new Date(Date.now() + 86400000 * (location === 'freezer' ? 90 : location === 'pantry' ? 180 : 7))
      setFridgeItems(prev => [...prev, {
        id: 'f' + Date.now(),
        productId: product.id,
        product,
        quantity,
        addedDate: new Date().toISOString(),
        expiryDate: expiryDate || defaultExpiry.toISOString(),
        location,
      }])
    }
  }, [fridgeItems])

  const removeFromFridge = useCallback((itemId) => {
    setFridgeItems(prev => prev.filter(i => i.id !== itemId))
  }, [])

  const updateQuantity = useCallback((itemId, delta) => {
    setFridgeItems(prev => prev.map(i => {
      if (i.id !== itemId) return i
      const newQty = i.quantity + delta
      return newQty <= 0 ? null : { ...i, quantity: newQty }
    }).filter(Boolean))
  }, [])

  const addToShopping = useCallback((product, quantity = 1, note = '') => {
    const existing = shoppingList.find(i => i.productId === product.id)
    if (existing) {
      setShoppingList(prev => prev.map(i =>
        i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i
      ))
    } else {
      setShoppingList(prev => [...prev, {
        id: 's' + Date.now(),
        productId: product.id,
        product,
        quantity,
        checked: false,
        priority: 'medium',
        note,
      }])
    }
  }, [shoppingList])

  const toggleShoppingItem = useCallback((itemId) => {
    setShoppingList(prev => prev.map(i =>
      i.id === itemId ? { ...i, checked: !i.checked } : i
    ))
  }, [])

  const removeFromShopping = useCallback((itemId) => {
    setShoppingList(prev => prev.filter(i => i.id !== itemId))
  }, [])

  const clearCheckedItems = useCallback(() => {
    setShoppingList(prev => prev.filter(i => !i.checked))
  }, [])

  const getExpiringItems = useCallback(() => {
    const threeDays = Date.now() + 86400000 * 3
    return fridgeItems.filter(i => new Date(i.expiryDate).getTime() < threeDays)
  }, [fridgeItems])

  const getLowItems = useCallback(() => {
    return fridgeItems.filter(i => i.quantity <= 1)
  }, [fridgeItems])

  const getRecipeSuggestions = useCallback(() => {
    const fridgeProductIds = new Set(fridgeItems.map(i => i.productId))
    return RECIPES.map(recipe => {
      const needed = recipe.ingredients.filter(ing => ing.productId)
      const have = needed.filter(ing => fridgeProductIds.has(ing.productId))
      const missing = needed.filter(ing => ing.productId && !fridgeProductIds.has(ing.productId))
      return { ...recipe, matchCount: have.length, missingCount: missing.length, missing }
    }).sort((a, b) => b.matchCount - a.matchCount)
  }, [fridgeItems])

  const addExpense = useCallback((expense) => {
    setExpenses(prev => [{ id: 'e' + Date.now(), ...expense }, ...prev])
  }, [])

  const toggleSavedRecipe = useCallback((recipeId) => {
    setSavedRecipes(prev =>
      prev.includes(recipeId) ? prev.filter(id => id !== recipeId) : [...prev, recipeId]
    )
  }, [])

  const totalMonthExpenses = expenses
    .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
    .reduce((sum, e) => sum + e.total, 0)

  return (
    <FridgeContext.Provider value={{
      fridgeItems, shoppingList, expenses, notifications, savedRecipes,
      addToFridge, removeFromFridge, updateQuantity,
      addToShopping, toggleShoppingItem, removeFromShopping, clearCheckedItems,
      getExpiringItems, getLowItems, getRecipeSuggestions,
      addExpense, toggleSavedRecipe,
      totalMonthExpenses,
    }}>
      {children}
    </FridgeContext.Provider>
  )
}

export function useFridge() {
  const ctx = useContext(FridgeContext)
  if (!ctx) throw new Error('useFridge must be used within FridgeProvider')
  return ctx
}
