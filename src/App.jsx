import { Routes, Route } from 'react-router-dom'
import { FridgeProvider } from './context/FridgeContext'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import FridgePage from './pages/FridgePage'
import ScannerPage from './pages/ScannerPage'
import RecipesPage from './pages/RecipesPage'
import ShoppingPage from './pages/ShoppingPage'
import PricesPage from './pages/PricesPage'
import TikTokPage from './pages/TikTokPage'
import StatsPage from './pages/StatsPage'

export default function App() {
  return (
    <FridgeProvider>
      <div className="app-container" dir="rtl">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/fridge" element={<FridgePage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/shopping" element={<ShoppingPage />} />
          <Route path="/prices" element={<PricesPage />} />
          <Route path="/tiktok" element={<TikTokPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
        <BottomNav />
      </div>
    </FridgeProvider>
  )
}
