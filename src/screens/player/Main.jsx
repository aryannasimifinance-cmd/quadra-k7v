import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { MEMBERS, courtById, dayLabel, fa, hourLabel } from '../../data'
import { openGames } from '../../select'
import { chime, haptic, systemNotify } from '../../fx'
import { ME, useStore } from '../../store'
import { Icon } from '../../components/ui'
import Home from './Home'
import Games from './Games'
import Shop from './Shop'
import Cafe from './Cafe'
import Me from './Me'
import { Coaches, Events, Journey, Notifications, Packages, Ranking } from './Pages'
import Wizard from '../wizard/Wizard'

const TABS = [
  { id: 'home', name: 'خانه', icon: 'home' },
  { id: 'games', name: 'بازی‌ها', icon: 'cal' },
  { id: 'new', name: '', icon: 'plus' },
  { id: 'shop', name: 'فروشگاه', icon: 'bag' },
  { id: 'me', name: 'من', icon: 'user' },
]
const PAGES = { coaches: Coaches, packages: Packages, ranking: Ranking, events: Events, notifs: Notifications, journey: Journey }

export default function Main() {
  const { cart, cafeCart = [] } = useStore()
  const [tab, setTab] = useState('home')
  const [page, setPage] = useState(null)
  // اپ مستقیم از صفحه‌ی + باز می‌شود؛ در مرحله‌ی اول ویزارد نوار پایین دیده می‌شود تا هر بخش دیگری را انتخاب کنند
  const [wizard, setWizard] = useState({})
  const [wzStep, setWzStep] = useState('intent')
  const [wzKey, setWzKey] = useState(0)
  const scrollRef = useRef(null)
  const cartN = cart.reduce((s, x) => s + x.qty, 0) + cafeCart.reduce((s, x) => s + x.qty, 0)
  useMatchmaking(setTab)
  useCafeReady(setTab)

  const nav = {
    tab: (t) => { setPage(null); setWizard(null); haptic(6); setTab(t); scrollRef.current?.scrollTo({ top: 0 }) },
    open: (name, props = {}) => { haptic(6); setPage({ name, props }); scrollRef.current?.scrollTo({ top: 0 }) },
    start: (preset = {}) => { setPage(null); setWizard(preset); setWzKey((k) => k + 1); scrollRef.current?.scrollTo({ top: 0 }) },
  }
  const Page = page && PAGES[page.name]
  const on = (id) => !wizard && (tab === id || (id === 'shop' && tab === 'cafe'))

  return (
    <motion.div className="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className={`app-scroll ${wizard && wzStep === 'intent' ? 'locked' : ''}`} ref={scrollRef}>
        <AnimatePresence mode="wait">
          {wizard ? (
            <motion.div key={'wz' + wzKey} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <Wizard preset={wizard} onStep={setWzStep} onClose={() => setWizard(null)} onDone={(t) => { setWizard(null); setTab(t) }} />
            </motion.div>
          ) : Page ? (
            <motion.div key={'p' + page.name} initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <Page {...page.props} nav={nav} onBack={() => setPage(null)} />
            </motion.div>
          ) : (
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              {tab === 'home' && <Home nav={nav} />}
              {tab === 'games' && <Games nav={nav} />}
              {tab === 'shop' && <Shop nav={nav} />}
              {tab === 'cafe' && <Cafe nav={nav} />}
              {tab === 'me' && <Me nav={nav} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {(
          <motion.nav className="nav" initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            {TABS.map((t) => t.id === 'new' ? (
              <motion.button key={t.id} className={`fab ${wizard ? 'on' : ''}`} whileTap={{ scale: 0.85, rotate: 90 }} whileHover={{ scale: 1.06 }} onClick={() => nav.start({})} aria-label="بازی جدید">
                <Icon name="plus" size={28} stroke={2.6} />
              </motion.button>
            ) : (
              <button key={t.id} className={`nav-i ${on(t.id) ? 'on' : ''}`} onClick={() => nav.tab(t.id === 'shop' && tab === 'cafe' ? 'cafe' : t.id)}>
                {on(t.id) && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <span className="nav-ic">
                  <Icon name={t.id === 'shop' && tab === 'cafe' ? 'cup' : t.icon} size={22} stroke={on(t.id) ? 2.5 : 1.8} />
                  {t.id === 'shop' && cartN > 0 && <motion.i key={cartN} className="nav-badge" initial={{ scale: 0 }} animate={{ scale: 1 }}>{fa(cartN)}</motion.i>}
                </span>
                <small>{t.id === 'shop' && tab === 'cafe' ? 'کافه' : t.name}</small>
              </button>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// وقتی کافه سفارش کاربر را آماده کرد، اعلان و پیام داده می‌شود (پنل مدیر در تب دیگر)
function useCafeReady(setTab) {
  const { club, toast, notify } = useStore()
  const seen = useRef(null)
  useEffect(() => {
    const st = Object.fromEntries(club.cafeOrders.filter((o) => o.by === ME).slice(0, 10).map((o) => [o.id, o.status]))
    if (seen.current) Object.entries(st).forEach(([id, s]) => {
      if (s === 'ready' && seen.current[id] && seen.current[id] !== 'ready') {
        const o = club.cafeOrders.find((x) => x.id === id)
        const body = o.to ? `داریم میاریم سر ${courtById(o.to).name}.` : 'از کافه تحویل بگیرید.'
        chime('alarm'); haptic([40, 30, 40]); systemNotify('کافه‌ی کوادرا', `سفارش ${id} آماده‌ست. ${body}`)
        notify({ icon: '☕', title: `سفارش ${id} آماده‌ست`, body })
        toast({ icon: '☕', title: 'سفارش کافه آماده‌ست', body, duration: 6000, action: { label: 'ببینید', run: () => setTab('cafe') } })
      }
    })
    seen.current = st
  }, [club.cafeOrders])
}

// شبیه‌ساز مچ‌میکینگ: بازیکن‌های هم‌سطح برای جاهای خالی بازی‌های باز کاربر درخواست می‌دهند
function useMatchmaking(setTab) {
  const store = useStore()
  const live = useRef(store); live.current = store
  const asked = useRef(new Set())

  useEffect(() => {
    const t = setInterval(() => {
      const { club, toast, notify, fillSpot } = live.current
      const mine = club.bookings.filter((b) => b.by === ME && b.type === 'open' && b.status === 'ok' && b.players.length < 4 && !asked.current.has(b.id + b.players.length))
      if (!mine.length || Math.random() < 0.3) return
      const b = mine[0]
      asked.current.add(b.id + b.players.length)
      const pool = b.visibility === 'private'
        ? MEMBERS.filter((m) => !m.inactive && (b.invited || []).includes(m.id) && !b.players.includes(m.id))
        : MEMBERS.filter((m) => !m.inactive && b.levels.includes(m.level) && !b.players.includes(m.id))
      if (!pool.length) return
      const m = pool[Math.floor(Math.random() * pool.length)]
      const body = `${m.name} (سطح ${m.level}، ${fa(m.games)} بازی) ${b.visibility === 'private' ? 'دعوت شما را قبول کرد و می‌خواد به' : 'می‌خواد به'} بازی ${dayLabel(b.date)} ساعت ${hourLabel(b.start)} در ${courtById(b.court).name} بپیونده.`
      chime('alarm'); haptic([60, 40, 60])
      systemNotify('کوادرا، درخواست پیوستن', body)
      notify({ icon: '🙋', title: 'درخواست پیوستن', body })
      toast({ icon: '🙋', title: `${m.name.split(' ')[0]} می‌خواد بازی کنه`, body: `سطح ${m.level}، ${courtById(b.court).name}`, duration: 6500,
        action: { label: 'قبول', run: () => { fillSpot(b.id, m.id); chime('success'); toast({ icon: '🧩', title: 'یار جدید اضافه شد', body: `${fa(4 - b.players.length - 1)} جای خالی مونده` }) } } })
    }, 10000)
    return () => clearInterval(t)
  }, [])

  // یک بار در هر نشست: اعلان بازی باز هم‌سطح
  useEffect(() => {
    const t = setTimeout(() => {
      const { user, club, toast } = live.current
      const g = openGames(club, user.level).find((b) => !b.mine && b.gap <= 1)
      if (!g) return
      chime('alarm'); haptic([40, 30, 40])
      toast({ icon: '📣', title: 'بازی هم‌سطح شما پیدا شد', body: `${dayLabel(g.date)} ${hourLabel(g.start)}، ${fa(4 - g.players.length)} جای خالی`, duration: 6000, action: { label: 'ببینید', run: () => setTab('games') } })
    }, 15000)
    return () => clearTimeout(t)
  }, [])
}
