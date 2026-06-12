import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/* ============================================================
   ChefTok 🧑‍🍳 — עוזר בישול אינטראקטיבי בידיים חופשיות
   פרוטוטייפ באיכות גבוהה: מצב מטבח, זיהוי קול ומחוות,
   טיימרים חכמים, מחשבון המרות, ומד התקדמות.
   ============================================================ */

const RECIPES = [
  {
    id: 'mousse',
    title: 'עוגת מוס שוקולד ופרלינה חגיגית',
    chef: 'השף דניאל לוי',
    emoji: '🍫',
    gradient: 'from-[#5b2c1d] via-[#8a4b32] to-[#c97b53]',
    difficulty: 'מורכב',
    totalTime: '4 שעות',
    badge: 'אפייה מתקדמת',
    steps: [
      {
        title: 'הכנת בסיס פרלינה פריך',
        instruction: 'ממיסים את שוקולד החלב, מערבבים עם הפאייטה וחמאת הבוטנים ומשטחים בתחתית התבנית לשכבה אחידה.',
        emoji: '🥜',
        ingredients: [
          { name: 'שוקולד חלב', emoji: '🍫', metric: '200 גרם', home: '1 חבילה' },
          { name: 'פתיתי פאייטה', emoji: '🌾', metric: '80 גרם', home: '1.5 כוסות' },
          { name: 'חמאת בוטנים', emoji: '🥜', metric: '40 גרם', home: '2 כפות' },
        ],
      },
      {
        title: 'הקצפת שמנת מתוקה',
        instruction: 'מקציפים את השמנת המתוקה עם הסוכר במהירות גבוהה עד לקצף יציב. לא להפריז כדי שלא ייווצר חמאה.',
        emoji: '🥛',
        ingredients: [
          { name: 'שמנת מתוקה', emoji: '🥛', metric: '250 מ"ל', home: 'כוס אחת' },
          { name: 'סוכר', emoji: '🍚', metric: '30 גרם', home: '2 כפות' },
        ],
      },
      {
        title: 'המסת שוקולד מריר בבן-מארי',
        instruction: 'ממיסים את השוקולד המריר עם החמאה מעל קערה של מים רותחים, מערבבים עד למרקם חלק ומבריק.',
        emoji: '♨️',
        timer: { seconds: 90, label: 'המסה עדינה' },
        ingredients: [
          { name: 'שוקולד מריר 70%', emoji: '🍫', metric: '300 גרם', home: '1.5 חבילות' },
          { name: 'חמאה', emoji: '🧈', metric: '50 גרם', home: '3 כפות' },
        ],
      },
      {
        title: 'קיפול עדין של המוס',
        instruction: 'מקפלים בעדינות את השמנת המוקצפת אל תוך השוקולד המומס בתנועות מלמטה למעלה, יוצקים מעל הפרלינה.',
        emoji: '🌀',
        ingredients: [
          { name: 'תערובת שוקולד', emoji: '🍫', metric: 'מהשלב הקודם', home: 'מהשלב הקודם' },
          { name: 'שמנת מוקצפת', emoji: '🥛', metric: 'מהשלב 2', home: 'מהשלב 2' },
        ],
      },
      {
        title: 'קירור וקישוט',
        instruction: 'מעבירים את העוגה לקירור עד להתייצבות מלאה, מפזרים מעל קקאו ופנינים זהובות לפני ההגשה.',
        emoji: '❄️',
        timer: { seconds: 120, label: 'התייצבות במקרר' },
        ingredients: [
          { name: 'אבקת קקאו', emoji: '🟤', metric: '10 גרם', home: '1 כף' },
          { name: 'פנינים זהב', emoji: '✨', metric: 'לקישוט', home: 'לקישוט' },
        ],
      },
    ],
  },
  {
    id: 'pasta',
    title: 'פסטה רוזה ביתית מושלמת ב-15 דקות',
    chef: 'השפית נועה ברק',
    emoji: '🍝',
    gradient: 'from-[#ff6b6b] via-[#ff8e72] to-[#ffb88c]',
    difficulty: 'מהיר',
    totalTime: '15 דקות',
    badge: 'בישול מהיר',
    steps: [
      {
        title: 'הרתחת מים ובישול הפסטה',
        instruction: 'מרתיחים מים עם מלח גס, מוסיפים את הפנה ומבשלים אל-דנטה. שומרים מעט ממי הבישול בצד.',
        emoji: '💧',
        timer: { seconds: 60, label: 'בישול אל-דנטה' },
        ingredients: [
          { name: 'מים', emoji: '💧', metric: '2 ליטר', home: '8 כוסות' },
          { name: 'מלח גס', emoji: '🧂', metric: '15 גרם', home: '1 כף' },
          { name: 'פסטה פנה', emoji: '🍝', metric: '250 גרם', home: '2.5 כוסות' },
        ],
      },
      {
        title: 'הכנת בסיס הרוטב',
        instruction: 'מטגנים שום קצוץ בשמן זית עד להזהבה, מוסיפים רסק עגבניות ומבשלים דקה לשחרור הצבע והטעם.',
        emoji: '🍅',
        ingredients: [
          { name: 'שמן זית', emoji: '🫒', metric: '30 מ"ל', home: '2 כפות' },
          { name: 'שום', emoji: '🧄', metric: '2 שיניים', home: '2 שיניים' },
          { name: 'רסק עגבניות', emoji: '🍅', metric: '45 גרם', home: '3 כפות' },
        ],
      },
      {
        title: 'הפיכת הרוטב לרוזה',
        instruction: 'מוסיפים שמנת מתוקה ופרמזן מגורר, מערבבים על אש נמוכה עד לרוטב קטיפתי בגוון ורוד.',
        emoji: '🌸',
        ingredients: [
          { name: 'שמנת מתוקה', emoji: '🥛', metric: '200 מ"ל', home: '3/4 כוס' },
          { name: 'פרמזן מגורר', emoji: '🧀', metric: '50 גרם', home: '1/2 כוס' },
        ],
      },
      {
        title: 'איחוד והגשה',
        instruction: 'מערבבים את הפסטה ברוטב עם מעט ממי הבישול עד לציפוי מושלם, מגישים עם עלי בזיליקום טריים.',
        emoji: '🌿',
        ingredients: [
          { name: 'מי בישול', emoji: '💧', metric: '60 מ"ל', home: '1/4 כוס' },
          { name: 'בזיליקום טרי', emoji: '🌿', metric: 'חופן', home: 'חופן' },
        ],
      },
    ],
  },
  {
    id: 'sourdough',
    title: 'לחם מחמצת כפרי עם אחוז הידרציה גבוה',
    chef: 'האופה איתי גבע',
    emoji: '🍞',
    gradient: 'from-[#a9743f] via-[#c79a5b] to-[#e8c887]',
    difficulty: 'מתקדם',
    totalTime: '24 שעות',
    badge: 'בצק מתקדם',
    steps: [
      {
        title: 'רענון המחמצת',
        instruction: 'מאכילים את המחמצת בקמח מלא ומים פושרים, ממתינים עד שמכפילה את נפחה וצפה במים.',
        emoji: '🫧',
        timer: { seconds: 90, label: 'הפעלת המחמצת' },
        ingredients: [
          { name: 'מחמצת פעילה', emoji: '🫧', metric: '50 גרם', home: '3 כפות' },
          { name: 'קמח מלא', emoji: '🌾', metric: '50 גרם', home: '1/3 כוס' },
          { name: 'מים פושרים', emoji: '💧', metric: '50 מ"ל', home: '3 כפות' },
        ],
      },
      {
        title: 'אוטוליזה — מנוחת הבצק',
        instruction: 'מערבבים קמח ומים בלבד ללא לישה ומניחים למנוחה. שלב זה מפתח גלוטן באופן טבעי ללא מאמץ.',
        emoji: '😴',
        timer: { seconds: 60, label: 'אוטוליזה' },
        ingredients: [
          { name: 'קמח לחם', emoji: '🌾', metric: '500 גרם', home: '4 כוסות' },
          { name: 'מים', emoji: '💧', metric: '375 מ"ל', home: '1.5 כוסות' },
        ],
      },
      {
        title: 'לישה וקיפולים',
        instruction: 'מוסיפים מלח ומחמצת, מבצעים סדרת קיפולים נמרצים מהצד אל המרכז עד שהבצק חלק ואלסטי.',
        emoji: '💪',
        timer: { seconds: 75, label: 'סדרת קיפולים' },
        ingredients: [
          { name: 'מלח ים', emoji: '🧂', metric: '10 גרם', home: '2 כפיות' },
          { name: 'מחמצת מהשלב 1', emoji: '🫧', metric: '100 גרם', home: '6 כפות' },
        ],
      },
      {
        title: 'תפיחה ראשונה בטמפ\' החדר',
        instruction: 'מכסים ומניחים לתפיחה. מבצעים קיפול עדין כל 30 דקות עד שהבצק תופח ומתמלא בועות אוויר.',
        emoji: '🎈',
        timer: { seconds: 90, label: 'תפיחה ראשונה' },
        ingredients: [
          { name: 'הבצק מהשלב הקודם', emoji: '🍥', metric: 'כל הכמות', home: 'כל הכמות' },
        ],
      },
      {
        title: 'עיצוב וקירור לילה',
        instruction: 'מעצבים את הבצק לכדור מתוח, מעבירים לסלסלת הקמחה ולמקרר ללילה שלם לפיתוח טעמים חמצמצים.',
        emoji: '🌙',
        ingredients: [
          { name: 'קמח אורז לפיזור', emoji: '🌾', metric: '20 גרם', home: '2 כפות' },
        ],
      },
      {
        title: 'אפייה בסיר יצקת',
        instruction: 'אופים בסיר לוהט ומכוסה ליצירת קרום, ואז חושפים להזהבה מושלמת. מצננים על רשת לפני הפריסה.',
        emoji: '🔥',
        timer: { seconds: 120, label: 'אפייה מכוסה' },
        ingredients: [
          { name: 'הבצק התפוח', emoji: '🍞', metric: 'כיכר אחת', home: 'כיכר אחת' },
        ],
      },
    ],
  },
]

/* ---------- כלי עזר ---------- */
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.stop(ctx.currentTime + 0.6)
  } catch (e) { /* התעלמות בשקט */ }
}

/* ============================================================
   טיימר חכם — ספירה לאחור עם play/pause/reset והתפוצצות ב-0
   ============================================================ */
function SmartTimer({ seconds, label, t }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setRemaining(seconds)
    setRunning(false)
    setDone(false)
  }, [seconds])

  useEffect(() => {
    if (!running) return undefined
    if (remaining <= 0) {
      setRunning(false)
      setDone(true)
      beep()
      return undefined
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(id)
  }, [running, remaining])

  const reset = () => {
    setRemaining(seconds)
    setRunning(false)
    setDone(false)
  }

  const pct = Math.max(0, Math.min(100, (remaining / seconds) * 100))

  return (
    <div
      className={`rounded-3xl border-2 p-5 transition-all ${
        done
          ? 'border-[#ff4757] bg-[#ff4757]/10 animate-ct-explode'
          : `${t.border} ${t.card}`
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xl font-bold ${t.text}`}>⏱️ {label}</span>
        {done && (
          <span className="text-xl font-extrabold text-[#ff4757] animate-bounce">
            🔔 הזמן נגמר!
          </span>
        )}
      </div>

      <div
        className={`text-center font-black tabular-nums leading-none mb-3 ${
          done ? 'text-[#ff4757] animate-ping-slow' : t.text
        }`}
        style={{ fontSize: '64px' }}
      >
        {done ? '0:00' : fmt(remaining)}
      </div>

      <div className={`h-3 rounded-full overflow-hidden mb-4 ${t.track}`}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${pct}%`,
            background: done ? '#ff4757' : 'linear-gradient(90deg,#2ed573,#ffa502)',
          }}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setRunning((r) => !r)}
          disabled={done}
          className={`flex-1 rounded-2xl py-3 text-2xl font-extrabold transition-all active:scale-95 ${
            running ? 'bg-amber-400 text-slate-900' : 'bg-[#2ed573] text-white'
          } disabled:opacity-40`}
        >
          {running ? '⏸️ השהה' : '▶️ התחל'}
        </button>
        <button
          onClick={reset}
          className={`rounded-2xl px-6 py-3 text-2xl font-extrabold border-2 transition-all active:scale-95 ${t.border} ${t.text}`}
        >
          🔄 איפוס
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   נגן הווידאו הלולאתי — מדמה את הקטע של השלב הנוכחי בלבד
   ============================================================ */
function VideoLooper({ step, playing, setPlaying, looping, setLooping, speed, setSpeed, t }) {
  return (
    <div className="flex flex-col h-full">
      <div
        className={`relative flex-1 min-h-[220px] rounded-3xl overflow-hidden border-2 ${t.border} bg-gradient-to-br ${step.gradient} shadow-2xl`}
      >
        {/* שכבת הדגמת וידאו לולאתית */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`text-[120px] drop-shadow-2xl ${
              playing ? 'animate-ct-float' : ''
            }`}
            style={{ animationDuration: `${2 / speed}s` }}
          >
            {step.emoji}
          </div>
        </div>

        {/* פס סריקה לולאתי */}
        {playing && (
          <div
            className="absolute left-0 right-0 h-1 bg-white/70 blur-sm animate-ct-scan"
            style={{ animationDuration: `${2.4 / speed}s` }}
          />
        )}

        {/* תגיות עליונות */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between">
          <span className="bg-black/45 text-white text-sm font-bold px-3 py-1 rounded-full backdrop-blur">
            🔁 קטע השלב הנוכחי
          </span>
          {looping && (
            <span className="bg-[#ff4757] text-white text-sm font-bold px-3 py-1 rounded-full animate-pulse">
              LOOP
            </span>
          )}
        </div>

        {/* תווית מהירות */}
        <span className="absolute bottom-3 left-3 bg-black/45 text-white text-sm font-extrabold px-3 py-1 rounded-full backdrop-blur">
          ×{speed}
        </span>
      </div>

      {/* בקרות הנגן */}
      <div className={`mt-3 flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2 ${t.border} ${t.card}`}>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="text-3xl active:scale-90 transition-transform"
          aria-label="הפעל או השהה"
        >
          {playing ? '⏸️' : '▶️'}
        </button>
        <button
          onClick={() => setLooping((l) => !l)}
          className={`text-2xl px-3 py-1 rounded-xl font-bold transition-all ${
            looping ? 'bg-[#ff4757] text-white' : `${t.text} opacity-50`
          }`}
          aria-label="לולאה"
        >
          🔁
        </button>
        <div className="flex items-center gap-1">
          {[0.5, 1, 1.5, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2.5 py-1.5 rounded-xl text-lg font-extrabold transition-all ${
                speed === s ? 'bg-[#ff4757] text-white' : `${t.card} ${t.text} border-2 ${t.border}`
              }`}
            >
              ×{s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   רכיב ראשי
   ============================================================ */
export default function ChefTok() {
  const navigate = useNavigate()
  const [screen, setScreen] = useState('home') // 'home' | 'cook'
  const [recipeId, setRecipeId] = useState(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [unitMode, setUnitMode] = useState('metric') // 'metric' | 'home'
  const [dark, setDark] = useState(false)
  const [url, setUrl] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [gesture, setGesture] = useState(null)

  // בקרות נגן
  const [playing, setPlaying] = useState(true)
  const [looping, setLooping] = useState(true)
  const [speed, setSpeed] = useState(1)

  const gestureTimer = useRef(null)

  const recipe = RECIPES.find((r) => r.id === recipeId) || null
  const step = recipe ? recipe.steps[stepIndex] : null
  const stepWithMedia = step ? { ...step, gradient: recipe.gradient } : null

  const t = dark
    ? {
        bg: 'bg-slate-950',
        panel: 'bg-slate-900',
        text: 'text-slate-50',
        sub: 'text-slate-400',
        border: 'border-slate-700',
        card: 'bg-slate-800',
        track: 'bg-slate-700',
      }
    : {
        bg: 'bg-[#fff8f6]',
        panel: 'bg-white',
        text: 'text-slate-900',
        sub: 'text-slate-500',
        border: 'border-[#ffd9d0]',
        card: 'bg-[#fff1ee]',
        track: 'bg-slate-200',
      }

  const flash = useCallback((label) => {
    setGesture(label)
    if (gestureTimer.current) clearTimeout(gestureTimer.current)
    gestureTimer.current = setTimeout(() => setGesture(null), 1000)
  }, [])

  const speak = useCallback((textStep) => {
    if (!textStep) return
    const ingText = textStep.ingredients
      .map((i) => `${i.name}, ${unitMode === 'metric' ? i.metric : i.home}`)
      .join('. ')
    const full = `שלב ${stepIndex + 1}. ${textStep.title}. ${textStep.instruction}. המצרכים: ${ingText}`
    setSpeaking(true)
    try {
      const synth = window.speechSynthesis
      if (synth) {
        synth.cancel()
        const u = new SpeechSynthesisUtterance(full)
        u.lang = 'he-IL'
        u.rate = 0.95
        u.onend = () => setSpeaking(false)
        u.onerror = () => setSpeaking(false)
        synth.speak(u)
      } else {
        setTimeout(() => setSpeaking(false), 2200)
      }
    } catch (e) {
      setTimeout(() => setSpeaking(false), 2200)
    }
  }, [stepIndex, unitMode])

  const next = useCallback(() => {
    if (!recipe) return
    setStepIndex((i) => {
      if (i < recipe.steps.length - 1) {
        flash('➡️ הבא')
        return i + 1
      }
      flash('🎉 סיימת!')
      return i
    })
  }, [recipe, flash])

  const prev = useCallback(() => {
    if (!recipe) return
    setStepIndex((i) => {
      if (i > 0) {
        flash('⬅️ חזרה')
        return i - 1
      }
      return i
    })
  }, [recipe, flash])

  const repeat = useCallback(() => {
    flash('🔊 קורא שוב')
    speak(recipe ? recipe.steps[stepIndex] : null)
  }, [recipe, stepIndex, speak, flash])

  // מאזין מקלדת — פעיל רק במצב בישול
  useEffect(() => {
    if (screen !== 'cook') return undefined
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === 'ArrowLeft') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        prev()
      } else if (e.key === 'v' || e.key === 'V' || e.key === 'ו') {
        e.preventDefault()
        repeat()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, next, prev, repeat])

  // ניקוי דיבור ביציאה
  useEffect(() => () => { try { window.speechSynthesis?.cancel() } catch (e) {} }, [])

  const startCooking = (id) => {
    setRecipeId(id)
    setStepIndex(0)
    setUnitMode('metric')
    setPlaying(true)
    setLooping(true)
    setSpeed(1)
    setScreen('cook')
  }

  const exitCooking = () => {
    try { window.speechSynthesis?.cancel() } catch (e) {}
    setScreen('home')
    setRecipeId(null)
  }

  /* ============================ מסך הבית ============================ */
  const HomeScreen = (
    <div className={`min-h-full ${t.bg} ${t.text} transition-colors`}>
      {/* כותרת עליונה */}
      <header className="bg-gradient-to-l from-[#ff4757] via-[#ff6b6b] to-[#ff7f50] text-white px-5 pt-8 pb-10 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute -top-8 -left-8 text-[160px] opacity-15 select-none">🍳</div>
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-2">
            <span className="text-4xl">🧑‍🍳</span>
            <h1 className="text-4xl font-black tracking-tight">ChefTok</h1>
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            className="bg-white/20 backdrop-blur rounded-full px-4 py-2 text-xl font-bold active:scale-95 transition-transform"
          >
            {dark ? '☀️ יום' : '🌙 ערב'}
          </button>
        </div>
        <p className="text-xl font-medium mt-3 opacity-95 relative">
          הופכים סרטוני בישול קצרים למתכון אינטראקטיבי — בלי לגעת במסך 👐
        </p>
      </header>

      <main className="px-5 -mt-5 relative pb-28">
        {/* שורת קלט */}
        <div className={`rounded-3xl border-2 ${t.border} ${t.panel} shadow-lg p-4`}>
          <label className={`text-lg font-bold ${t.sub} block mb-2`}>
            🔗 הדביקו קישור לסרטון TikTok / YouTube
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tiktok.com/@chef/video..."
            className={`w-full rounded-2xl border-2 ${t.border} ${t.card} ${t.text} px-4 py-3 text-lg font-medium outline-none focus:border-[#ff4757] transition-colors`}
          />
          <button
            onClick={() => startCooking('pasta')}
            className="mt-3 w-full bg-gradient-to-l from-[#ff4757] to-[#ff6b6b] text-white rounded-2xl py-4 text-2xl font-black shadow-lg shadow-[#ff4757]/30 active:scale-[0.98] transition-transform"
          >
            ⚡ התחל לבשל בטכנולוגיית Hands-Free
          </button>
        </div>

        {/* כותרת דוגמאות */}
        <div className="flex items-center justify-between mt-8 mb-3">
          <h2 className="text-2xl font-extrabold">🔥 מתכונים מומלצים</h2>
          <span className={`text-base font-bold ${t.sub}`}>{RECIPES.length} מתכונים</span>
        </div>

        {/* כרטיסי מתכונים */}
        <div className="space-y-4">
          {RECIPES.map((r) => (
            <button
              key={r.id}
              onClick={() => startCooking(r.id)}
              className={`w-full text-right rounded-3xl border-2 ${t.border} ${t.panel} shadow-md overflow-hidden flex active:scale-[0.99] transition-transform`}
            >
              {/* תמונה ממוזערת */}
              <div className={`w-28 shrink-0 bg-gradient-to-br ${r.gradient} flex items-center justify-center relative`}>
                <span className="text-6xl drop-shadow-lg">{r.emoji}</span>
                <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  ▶ {r.steps.length} שלבים
                </span>
              </div>
              {/* פרטים */}
              <div className="flex-1 p-3">
                <span className="inline-block bg-[#ff4757]/10 text-[#ff4757] text-sm font-extrabold px-2.5 py-0.5 rounded-full mb-1">
                  {r.badge}
                </span>
                <h3 className="text-xl font-extrabold leading-tight">{r.title}</h3>
                <p className={`text-base ${t.sub} mt-1 font-medium`}>{r.chef}</p>
                <div className={`flex items-center gap-3 mt-2 text-base font-bold ${t.sub}`}>
                  <span>⏱️ {r.totalTime}</span>
                  <span>•</span>
                  <span>📊 {r.difficulty}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate('/')}
          className={`mt-8 w-full rounded-2xl border-2 ${t.border} ${t.text} py-3 text-lg font-bold active:scale-95 transition-transform`}
        >
          ← חזרה ל-FridgeTok
        </button>
      </main>
    </div>
  )

  /* ============================ מסך בישול ============================ */
  const CookScreen = recipe && (
    <div className={`min-h-full flex flex-col ${t.bg} ${t.text} transition-colors`}>
      {/* פס עליון — זיהוי קול ומחוות */}
      <div className="bg-gradient-to-l from-[#ff4757] to-[#ff6b6b] text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
        <button onClick={exitCooking} className="text-2xl font-bold active:scale-90 transition-transform" aria-label="יציאה">
          ✕
        </button>
        <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full">
          <span className="w-3 h-3 rounded-full bg-[#2ed573] animate-ct-blink" />
          <span className="text-base sm:text-lg font-extrabold">📡 זיהוי מחוות וקול פעיל (מצב מטבח)</span>
        </div>
        <button
          onClick={() => setDark((d) => !d)}
          className="text-2xl active:scale-90 transition-transform"
          aria-label="מצב תאורה"
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </div>

      {/* מד התקדמות אינטראקטיבי */}
      <div className={`px-4 py-3 ${t.panel} border-b-2 ${t.border}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-lg font-extrabold truncate">{recipe.title}</span>
          <span className="text-lg font-black text-[#ff4757] shrink-0">
            שלב {stepIndex + 1}/{recipe.steps.length}
          </span>
        </div>
        <div className={`h-3 rounded-full overflow-hidden ${t.track}`}>
          <div
            className="h-full rounded-full bg-gradient-to-l from-[#ff4757] to-[#2ed573] transition-all duration-500"
            style={{ width: `${((stepIndex + 1) / recipe.steps.length) * 100}%` }}
          />
        </div>
        {/* נקודות שלבים */}
        <div className="flex justify-between mt-2">
          {recipe.steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIndex(i)}
              className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-black transition-all ${
                i < stepIndex
                  ? 'bg-[#2ed573] text-white'
                  : i === stepIndex
                  ? 'bg-[#ff4757] text-white scale-110 shadow-lg'
                  : `${t.card} ${t.sub} border-2 ${t.border}`
              }`}
            >
              {i < stepIndex ? '✓' : i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* גוף — שני פאנלים */}
      <div className="flex-1 grid lg:grid-cols-2 gap-4 p-4 overflow-y-auto">
        {/* פאנל א' — נגן הווידאו */}
        <div className="order-1">
          <VideoLooper
            step={stepWithMedia}
            playing={playing}
            setPlaying={setPlaying}
            looping={looping}
            setLooping={setLooping}
            speed={speed}
            setSpeed={setSpeed}
            t={t}
          />
        </div>

        {/* פאנל ב' — כרטיס השלב הפעיל */}
        <div className="order-2 flex flex-col gap-4">
          <div className={`rounded-3xl border-2 ${t.border} ${t.panel} p-5 shadow-lg`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#ff4757] text-white text-3xl font-black shrink-0">
                  {stepIndex + 1}
                </span>
                <h2 className="text-3xl font-black leading-tight">{step.title}</h2>
              </div>
            </div>
            <p className="text-2xl font-medium leading-relaxed">{step.instruction}</p>

            {speaking && (
              <div className="mt-4 flex items-center gap-2 text-[#ff4757] font-extrabold text-xl animate-pulse">
                🔊 קורא בקול
                <span className="flex gap-1">
                  <span className="w-1.5 h-5 bg-[#ff4757] rounded-full animate-ct-bar" />
                  <span className="w-1.5 h-5 bg-[#ff4757] rounded-full animate-ct-bar" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1.5 h-5 bg-[#ff4757] rounded-full animate-ct-bar" style={{ animationDelay: '0.3s' }} />
                </span>
              </div>
            )}
          </div>

          {/* כרטיסיית מצרכים ממוקדת + מחשבון המרות */}
          <div className={`rounded-3xl border-2 ${t.border} ${t.card} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-extrabold">🧺 מצרכים לשלב זה</h3>
              {/* טוגל המרות חכם */}
              <div className={`flex rounded-full border-2 ${t.border} overflow-hidden text-base font-extrabold`}>
                <button
                  onClick={() => setUnitMode('metric')}
                  className={`px-3 py-1.5 transition-all ${unitMode === 'metric' ? 'bg-[#ff4757] text-white' : t.text}`}
                >
                  ⚖️ גרמים
                </button>
                <button
                  onClick={() => setUnitMode('home')}
                  className={`px-3 py-1.5 transition-all ${unitMode === 'home' ? 'bg-[#ff4757] text-white' : t.text}`}
                >
                  🥄 ביתי
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {step.ingredients.map((ing, idx) => (
                <li
                  key={idx}
                  className={`flex items-center justify-between gap-3 rounded-2xl ${t.panel} border-2 ${t.border} px-4 py-3`}
                >
                  <span className="flex items-center gap-2 text-2xl font-bold">
                    <span className="text-3xl">{ing.emoji}</span>
                    {ing.name}
                  </span>
                  <span className="text-2xl font-black text-[#ff4757] tabular-nums">
                    {unitMode === 'metric' ? ing.metric : ing.home}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* טיימר חכם — רק בשלבים רלוונטיים */}
          {step.timer && (
            <SmartTimer seconds={step.timer.seconds} label={step.timer.label} t={t} />
          )}
        </div>
      </div>

      {/* בקרת ידיים חופשיות — כפתורים גדולים */}
      <div className={`${t.panel} border-t-2 ${t.border} p-4 shadow-2xl`}>
        <div className="grid grid-cols-3 gap-3 max-w-3xl mx-auto">
          <button
            onClick={prev}
            disabled={stepIndex === 0}
            className={`rounded-2xl py-4 text-2xl font-black border-2 ${t.border} ${t.text} active:scale-95 transition-transform disabled:opacity-30`}
          >
            ⬅️ חזור
            <span className={`block text-sm font-bold ${t.sub} mt-0.5`}>חץ ימינה</span>
          </button>
          <button
            onClick={repeat}
            className="rounded-2xl py-4 text-2xl font-black bg-amber-400 text-slate-900 active:scale-95 transition-transform"
          >
            🔊 קרא שוב
            <span className="block text-sm font-bold opacity-70 mt-0.5">מקש V</span>
          </button>
          <button
            onClick={next}
            className="rounded-2xl py-4 text-2xl font-black bg-gradient-to-l from-[#ff4757] to-[#ff6b6b] text-white active:scale-95 transition-transform"
          >
            הבא ➡️
            <span className="block text-sm font-bold opacity-80 mt-0.5">רווח / חץ שמאלה</span>
          </button>
        </div>
      </div>

      {/* משוב מחווה */}
      {gesture && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
          <div className="bg-black/75 text-white text-5xl font-black px-10 py-6 rounded-3xl animate-ct-pop">
            {gesture}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto" style={{ fontFamily: 'Heebo, Arial, sans-serif' }} dir="rtl">
      {screen === 'home' ? HomeScreen : CookScreen}
    </div>
  )
}
