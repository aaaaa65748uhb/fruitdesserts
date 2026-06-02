import { useState } from 'react'
import { useFridge } from '../context/FridgeContext'
import { ISRAELI_PRODUCTS } from '../data/products'

const DEMO_BARCODES = [
  { barcode: '7290000066614', label: 'חלב תנובה' },
  { barcode: '7290000662236', label: 'שניצל זוגלובק' },
  { barcode: '7290000228259', label: 'שוקולד עלית' },
]

const RECENT_SCANS = [
  { barcode: '7290000066614', time: 'לפני 2 שעות' },
  { barcode: '7290002443582', time: 'אתמול' },
]

function getProductByBarcode(barcode) {
  return ISRAELI_PRODUCTS.find(p => p.barcode === barcode) || null
}

export default function ScannerPage() {
  const { addToFridge } = useFridge()
  const [barcode, setBarcode] = useState('')
  const [scannedProduct, setScannedProduct] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [addedLocation, setAddedLocation] = useState(null)
  const [addSuccess, setAddSuccess] = useState(false)

  function handleScan(code) {
    const bc = (code !== undefined ? code : barcode).trim()
    if (!bc) return
    setScanning(true)
    setNotFound(false)
    setScannedProduct(null)
    setAddSuccess(false)
    setAddedLocation(null)

    setTimeout(() => {
      const found = getProductByBarcode(bc)
      setScanning(false)
      if (found) {
        setScannedProduct(found)
      } else {
        setNotFound(true)
      }
    }, 900)
  }

  function handleAdd(location) {
    if (!scannedProduct) return
    addToFridge(scannedProduct, 1, location)
    setAddedLocation(location)
    setAddSuccess(true)
  }

  const locationLabels = { fridge: '🧊 מקרר', pantry: '🗄️ מזווה', freezer: '❄️ מקפיא' }

  return (
    <div className="page-content" style={{ background: '#f0f9ff' }}>
      <div className="gradient-header" style={{ padding: '1.25rem 1rem 1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>📷 סריקת ברקוד</h1>
        <p style={{ margin: '0.25rem 0 0', opacity: 0.85, fontSize: '0.82rem' }}>סרוק מוצר להוספה מהירה</p>
      </div>

      <div style={{ padding: '0.75rem' }}>
        {/* Camera Viewfinder */}
        <div style={{
          background: '#111827', borderRadius: 16, padding: '1.5rem', marginBottom: '0.75rem',
          position: 'relative', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {[
            { top: 12, right: 12, borderTop: '3px solid #00ff88', borderRight: '3px solid #00ff88' },
            { top: 12, left: 12, borderTop: '3px solid #00ff88', borderLeft: '3px solid #00ff88' },
            { bottom: 12, right: 12, borderBottom: '3px solid #00ff88', borderRight: '3px solid #00ff88' },
            { bottom: 12, left: 12, borderBottom: '3px solid #00ff88', borderLeft: '3px solid #00ff88' },
          ].map((style, i) => (
            <div key={i} style={{ position: 'absolute', width: 24, height: 24, ...style }} />
          ))}

          {!scanning && !scannedProduct && !notFound && <div className="scan-line" />}

          {scanning ? (
            <div style={{ textAlign: 'center', color: 'white' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>מחפש מוצר...</div>
            </div>
          ) : scannedProduct ? (
            <div style={{ textAlign: 'center', color: 'white', width: '100%' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{scannedProduct.image}</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{scannedProduct.name}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.25rem' }}>{scannedProduct.brand}</div>
              <div style={{
                display: 'inline-block', background: '#00ff88', color: '#111', borderRadius: 999,
                padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, marginTop: '0.5rem',
              }}>✓ נמצא!</div>
            </div>
          ) : notFound ? (
            <div style={{ textAlign: 'center', color: 'white' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>❌</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>מוצר לא נמצא</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📷</div>
              <div style={{ fontSize: '0.85rem' }}>הכנס ברקוד מטה</div>
            </div>
          )}
        </div>

        {/* Barcode Input */}
        <div className="card" style={{ marginBottom: '0.75rem', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: '#374151' }}>
            הזן ברקוד ידנית
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="729..."
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScan()}
              style={{
                flex: 1, padding: '0.65rem 0.85rem', border: '1.5px solid #e5e7eb',
                borderRadius: 10, fontSize: '0.9rem',
              }}
            />
            <button
              onClick={() => handleScan()}
              disabled={scanning}
              style={{
                padding: '0.65rem 1.25rem', background: 'linear-gradient(135deg, #0052CC, #0099B0)',
                border: 'none', borderRadius: 10, color: 'white',
                fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              }}
            >
              {scanning ? '...' : 'סרוק'}
            </button>
          </div>
        </div>

        {/* Demo Barcodes */}
        <div className="card" style={{ marginBottom: '0.75rem', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.65rem', color: '#374151' }}>
            💡 ברקודים לדוגמה
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {DEMO_BARCODES.map(d => (
              <button
                key={d.barcode}
                onClick={() => { setBarcode(d.barcode); handleScan(d.barcode) }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.6rem 0.85rem', background: '#f0f9ff', border: '1px solid #bfdbfe',
                  borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e40af' }}>{d.label}</span>
                <span style={{ fontSize: '0.72rem', color: '#6b7280', fontFamily: 'monospace', direction: 'ltr' }}>{d.barcode}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scanned Product Details */}
        {scannedProduct && !scanning && (
          <div className="card slide-up" style={{ marginBottom: '0.75rem', padding: '1rem' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '2.5rem' }}>{scannedProduct.image}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{scannedProduct.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.2rem' }}>
                  {scannedProduct.brand} · {scannedProduct.weight}{scannedProduct.unit}
                </div>
                {scannedProduct.kosher && (
                  <span style={{
                    background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem',
                    fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  }}>
                    כשר {scannedProduct.kosher}
                  </span>
                )}
              </div>
            </div>

            {scannedProduct.nutrition && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', marginBottom: '0.75rem' }}>
                {[
                  { label: 'קלוריות', val: scannedProduct.nutrition.calories },
                  { label: 'חלבון', val: `${scannedProduct.nutrition.protein}g` },
                  { label: "פחמ'", val: `${scannedProduct.nutrition.carbs}g` },
                  { label: 'שומן', val: `${scannedProduct.nutrition.fat}g` },
                ].map(n => (
                  <div key={n.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '0.4rem', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0052CC' }}>{n.val}</div>
                    <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{n.label}</div>
                  </div>
                ))}
              </div>
            )}

            {addSuccess ? (
              <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 12, padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>✅</div>
                <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.9rem' }}>
                  נוסף ל{addedLocation === 'fridge' ? 'מקרר' : addedLocation === 'pantry' ? 'מזווה' : 'מקפיא'}!
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', color: '#374151' }}>הוסף ל:</div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {['fridge', 'pantry', 'freezer'].map(loc => (
                    <button
                      key={loc}
                      onClick={() => handleAdd(loc)}
                      style={{
                        flex: 1, padding: '0.6rem', borderRadius: 10,
                        border: '1.5px solid #0052CC', background: '#EEF2FF',
                        color: '#0052CC', fontFamily: 'inherit', fontWeight: 700,
                        fontSize: '0.8rem', cursor: 'pointer',
                      }}
                    >
                      {locationLabels[loc]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {notFound && (
          <div className="card slide-up" style={{ marginBottom: '0.75rem', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>המוצר לא נמצא</div>
            <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.75rem' }}>
              נסה ברקוד אחר או הוסף ידנית מדף המקרר
            </div>
            <button
              onClick={() => { setNotFound(false); setBarcode('') }}
              style={{
                padding: '0.6rem 1.5rem', background: '#f3f4f6',
                border: 'none', borderRadius: 10, fontFamily: 'inherit',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              נסה שוב
            </button>
          </div>
        )}

        {/* Recently Scanned */}
        {!scannedProduct && !notFound && (
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.65rem', color: '#374151' }}>
              ⏱ נסרקו לאחרונה
            </div>
            {RECENT_SCANS.map((rs, i) => {
              const p = getProductByBarcode(rs.barcode)
              if (!p) return null
              return (
                <div
                  key={i}
                  onClick={() => { setBarcode(rs.barcode); handleScan(rs.barcode) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem',
                    borderRadius: 10, cursor: 'pointer', marginBottom: '0.3rem',
                    background: '#fafafa',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>{p.image}</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{rs.time}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
