import { NavLink } from 'react-router-dom'
import { useFridge } from '../context/FridgeContext'

const navItems = [
  { to: '/', label: 'בית', icon: '🏠' },
  { to: '/fridge', label: 'מקרר', icon: '🧊' },
  { to: '/scanner', label: 'סריקה', icon: '📷' },
  { to: '/recipes', label: 'מתכונים', icon: '🍳' },
  { to: '/shopping', label: 'קניות', icon: '🛒' },
  { to: '/prices', label: 'מחירים', icon: '💰' },
]

export default function BottomNav() {
  const { shoppingList, getExpiringItems } = useFridge()
  const unchecked = shoppingList.filter(i => !i.checked).length
  const expiring = getExpiringItems().length

  return (
    <nav className="bottom-nav">
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
              {item.to === '/shopping' && unchecked > 0 && (
                <span className="badge">{unchecked > 9 ? '9+' : unchecked}</span>
              )}
              {item.to === '/fridge' && expiring > 0 && (
                <span className="badge" style={{ background: '#f59e0b' }}>{expiring}</span>
              )}
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: 500 }}>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
