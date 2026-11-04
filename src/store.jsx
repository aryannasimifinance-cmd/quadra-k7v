import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { hoursOf, COURTS, PACKAGES, levelById, productById, seedClub, setCatalog, setCoaches, setMembers, todayKey, variantOf, withCoaches } from './data'
import { makeVariants, nextCode } from './catalog'
import { fits, nextIngCode, nextItemCode, placeCafe, receiveInto } from './cafe'
import { jMonthLabel } from './jalali'
import { payroll } from './hr'
import { withOps } from './ops'
import { syncBlocks, withEvents } from './events'

// داده‌ی باشگاه، حساب بازیکن و نشست هر تب جدا ذخیره می‌شوند تا مدیر و بازیکن در دو تب همزمان کار کنند
const KEY = 'quadra-v1'
const CLUB_KEY = 'quadra-club-v1'
const SESSION_KEY = 'quadra-session'
const SEED_V = 14
const blankPlayer = { user: null, xp: 0, badges: [], wallet: 0, rated: [], membership: null, cart: [], wish: [], notifications: [], quests: {}, events: [], cafeCart: [] }

// حساب نمونه برای «ورود سریع نمایشی»
const DEMO_ACCOUNTS = {
  '09120000000': { user: { name: 'آریان نسیمی‌فر', phone: '09120000000', level: 'C+', side: 'right', joined: Date.now() - 90 * 864e5 }, xp: 340, wallet: 800000, badges: ['first', 'host', 'social'] },
}
const read = (store, k) => { try { return JSON.parse(store.getItem(k)) } catch { return null } }
function load() {
  const club = read(localStorage, CLUB_KEY)
  const me = read(localStorage, KEY)
  // نشست: اول همین تب، بعد آخرین ورود روی این دستگاه
  let tab = null
  try { tab = sessionStorage.getItem(SESSION_KEY) } catch { /* */ }
  const session = tab !== null ? read(sessionStorage, SESSION_KEY) : read(localStorage, SESSION_KEY)
  if (club?.v === SEED_V) return { ...blankPlayer, accounts: DEMO_ACCOUNTS, ...me, session, club: withCoaches(withEvents(club)) }
  // داده‌ی تازه: مدیر وارد می‌ماند (مثلاً بعد از «بازنشانی داده‌ها»)، بازیکن از نو وارد می‌شود
  return { ...blankPlayer, accounts: DEMO_ACCOUNTS, session: session?.role === 'admin' ? session : null, club: withCoaches(withEvents(withOps(seedClub()))) }
}
// حساب بازیکن با ترتیب ثابت کلیدها، تا تب‌ها یک رشته‌ی یکسان بنویسند و رفت‌وبرگشت بی‌پایان پیش نیاید
const personalOf = (s) => JSON.stringify(Object.fromEntries([...Object.keys(blankPlayer), 'accounts'].map((k) => [k, s[k]])))
// بخش‌هایی از وضعیت که مال هر حساب است و با خروج کنار گذاشته می‌شود
const PERSONAL = Object.keys(blankPlayer)

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

export const ME = 'me'
export const weekKey = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); return d.toISOString().slice(0, 10) }

// امتیاز رنکینگ کاربر = پایه‌ی سطح + نصف XP
export const myPoints = (s) => (s.user ? levelById(s.user.level).base + Math.floor(s.xp / 2) : 0)
export const memberOff = (s) => (s.membership && s.membership.until > Date.now() ? packageById(s.membership.id).off : 0)
const packageById = (id) => PACKAGES.find((p) => p.id === id)

// وضعیت پرداخت هر رکورد — برای پنل مدیر
export function payState(x) {
  if (x.status === 'cancelled') return x.refunded ? 'refunded' : 'void'
  if (x.paid >= x.price) return 'paid'
  return x.paid > 0 ? 'partial' : 'pending'
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(load)
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)
  const ref = useRef(state)
  ref.current = state
  // کاتالوگ فروشگاه از داده‌ی باشگاه خوانده می‌شود تا کالاهای تازه‌ی مدیر در اپ بازیکن هم دیده شوند
  setCatalog(state.club.products)
  setMembers(state.club.members, state.club.memberEdits)
  setCoaches(state.club.coaches)

  const mine = personalOf(state)
  // اگر حافظه‌ی مرورگر پر شود (مثلاً عکس‌های زیاد) به مدیر هشدار داده می‌شود
  useEffect(() => {
    try { localStorage.setItem(CLUB_KEY, JSON.stringify(state.club)) } catch (e) {
      if (e?.name === 'QuotaExceededError') toastRef.current?.({ icon: '⚠️', title: 'حافظه‌ی مرورگر پر است', body: 'آخرین تغییر ذخیره نشد؛ چند عکس را حذف یا کوچک‌تر کنید.', duration: 6000 })
    }
  }, [state.club])
  useEffect(() => { try { localStorage.setItem(KEY, mine) } catch { /* */ } }, [mine])
  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session)); localStorage.setItem(SESSION_KEY, JSON.stringify(state.session)) } catch { /* */ }
  }, [state.session])

  // همگام‌سازی بین تب‌ها: مدیر و بازیکن در دو تب همزمان
  useEffect(() => {
    // داده‌ی باشگاه و حساب بازیکن همگام می‌شوند؛ نشست هر تب سر جای خودش می‌ماند
    const on = (e) => {
      if (!e.newValue || (e.key !== CLUB_KEY && e.key !== KEY)) return
      try {
        const v = JSON.parse(e.newValue)
        setState((s) => { const next = e.key === CLUB_KEY ? { ...s, club: v } : { ...s, ...v }; ref.current = next; return next })
      } catch { /* نادیده */ }
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  const toastRef = useRef(null)
  const toast = useCallback((t) => {
    const id = ++toastId.current
    setToasts((x) => [...x, { id, ...t }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.duration || 3200)
  }, [])

  toastRef.current = toast
  const api = useMemo(() => {
    const commit = (fn) => { const next = fn(ref.current); ref.current = next; setState(next); return next }
    const club = (fn) => commit((s) => ({ ...s, club: fn(s.club) }))

    // امتیاز و نشان؛ عضویت XP را دو برابر می‌کند
    function reward(s, xp, gives) {
      const earned = new Set(s.badges), fresh = []
      gives.filter(Boolean).forEach((id) => { if (!earned.has(id)) { earned.add(id); fresh.push(id) } })
      const mult = s.membership && s.membership.until > Date.now() ? 2 : 1
      const gain = xp * mult + fresh.length * 15
      return { next: { ...s, badges: [...earned], xp: s.xp + gain }, result: { xp: gain, badges: fresh, mult } }
    }
    function pay(s, amount, method) {
      if (method === 'wallet') return { ...s, wallet: s.wallet - amount }
      return s
    }
    const myCourts = (bookings) => new Set(bookings.filter((b) => b.players?.includes(ME) && b.status !== 'cancelled').map((b) => b.court))

    return {
      // ورود با شماره: اگر حساب قبلی هست، همان برمی‌گردد؛ وگرنه حساب تازه
      hasAccount(phone) { return !!ref.current.accounts?.[phone] },
      loginPlayer(user) {
        // «قبلاً عضو شده‌ام» با شماره‌ی ناشناخته: پروفایل نمونه با همان شماره
        const demo = DEMO_ACCOUNTS['09120000000']
        const saved = ref.current.accounts?.[user.phone] || (!user.name && { ...demo, user: { ...demo.user, phone: user.phone } })
        if (saved) { commit((s) => ({ ...s, ...blankPlayer, ...saved, user: { ...saved.user }, session: { role: 'player' } })); return }
        commit((s) => ({
          ...s, session: { role: 'player' }, user, ...(s.user ? {} : { xp: 20, wallet: 500000 }),
          club: (s.club.members || []).some((m) => m.phone === user.phone) ? s.club
            : { ...s.club, members: [...(s.club.members || []), { id: 'a' + user.phone, name: user.name, phone: user.phone, level: user.level, side: user.side || 'both', games: 0, wins: 0, points: levelById(user.level).base, joined: 0, at: Date.now(), source: 'app', member: null }] },
          notifications: s.user ? s.notifications : [{
            id: 'welcome', at: Date.now(), read: false, icon: '👋', title: `${user.name}، به کوادرا خوش اومدید`,
            body: '۲۰ امتیاز و ۵۰۰ هزار تومان اعتبار هدیه گرفتید. اولین بازیتون رو بسازید تا نشان «اولین سرو» باز بشه.',
          }],
        }))
      },
      loginAdmin() { commit((s) => ({ ...s, session: { role: 'admin' } })) },
      logout() {
        commit((s) => {
          if (s.session?.role === 'admin') return { ...s, session: null }
          const snap = Object.fromEntries(PERSONAL.map((k) => [k, s[k]]))
          const accounts = s.user?.phone ? { ...s.accounts, [s.user.phone]: snap } : s.accounts
          return { ...s, ...blankPlayer, accounts, session: null }
        })
      },
      resetDemo() { try { [KEY, CLUB_KEY].forEach((k) => localStorage.removeItem(k)); if (ref.current.session?.role !== 'admin') { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY) } } catch { /* */ } location.reload() },
      updateUser(p) { commit((s) => ({ ...s, user: { ...s.user, ...p } })) },

      // رزرو زمین یا کلاس — b شامل court,date,start,dur,type,price و ...
      book(b, method, share) {
        let out
        commit((s) => {
          const amount = share ?? b.price
          const rec = { id: 'u' + Date.now(), by: ME, status: 'ok', source: 'app', at: Date.now(), method, paid: method === 'package' || method === 'coach-pack' ? b.price : amount, ...b }
          const bookings = [...s.club.bookings, rec]
          const courts = myCourts(bookings)
          const full = rec.players.length === 4 && rec.players.every(Boolean)
          const r = reward(pay(s, amount, method), b.type === 'coach' ? 40 : b.type === 'open' ? 70 : 50, [
            'first', b.type === 'open' && 'host', b.start < 9 && 'early', b.start + b.dur > 22 && 'night',
            b.type === 'coach' && 'student', full && b.type !== 'coach' && 'squad', courts.size >= 4 && 'quad',
          ])
          out = { ...r.result, id: rec.id }
          return { ...r.next, club: { ...s.club, bookings } }
        })
        return out
      },
      joinGame(id, method, share) {
        let out
        commit((s) => {
          const b = s.club.bookings.find((x) => x.id === id)
          const players = [...b.players, ME]
          const bookings = s.club.bookings.map((x) => (x.id === id ? { ...x, players, paid: x.paid + share, invited: (x.invited || []).filter((p) => p !== ME) } : x))
          const r = reward(pay(s, share, method), 40, ['first', 'social', players.length === 4 && 'squad', myCourts(bookings).size >= 4 && 'quad'])
          out = { ...r.result, id }
          return { ...r.next, club: { ...s.club, bookings } }
        })
        return out
      },
      declineInvite(id) {
        commit((s) => ({ ...s, club: { ...s.club, bookings: s.club.bookings.map((b) => (b.id === id ? { ...b, invited: (b.invited || []).filter((p) => p !== ME) } : b)) } }))
      },
      // نظر ناشناس: فقط ستاره و متن ذخیره می‌شود، نه هویت کاربر؛ «rated» فقط روی دستگاه خود کاربر است تا دوبار نظر ندهد
      addReview(target, stars, text) {
        let out
        commit((s) => {
          // متن نظر منتظر تأیید مدیر می‌ماند؛ امتیاز ستاره‌ای همان لحظه حساب می‌شود
          const review = { id: 'r' + Date.now(), target, stars, text: text.trim(), at: Date.now(), ok: !text.trim() }
          const r = reward({ ...s, rated: [...(s.rated || []), target] }, 10, [])
          out = r.result
          return { ...r.next, club: { ...s.club, reviews: [review, ...(s.club.reviews || [])] } }
        })
        return out
      },
      cancelMine(id) {
        commit((s) => {
          const b = s.club.bookings.find((x) => x.id === id)
          const mine = b.by === ME
          const share = mine ? (b.type === 'open' ? Math.round(b.price / 4) : b.paid) : Math.round(b.price / 4)
          const bookings = s.club.bookings.map((x) => x.id !== id ? x : mine
            ? { ...x, status: 'cancelled', refunded: true }
            : { ...x, players: x.players.filter((p) => p !== ME), paid: x.paid - share })
          return { ...s, wallet: s.wallet + share, club: { ...s.club, bookings } }
        })
      },
      // تکمیل بازی باز با بازیکن هم‌سطح (شبیه‌ساز مچ‌میکینگ)
      fillSpot(id, memberId) {
        commit((s) => {
          const b = s.club.bookings.find((x) => x.id === id)
          if (!b || b.players.length >= 4 || b.status === 'cancelled') return s
          const players = [...b.players, memberId]
          const bookings = s.club.bookings.map((x) => (x.id === id ? { ...x, players, paid: x.paid + Math.round(x.price / 4) } : x))
          const r = reward(s, 5, [players.length === 4 && 'squad'])
          return { ...r.next, club: { ...s.club, bookings } }
        })
      },
      // ثبت‌نام دونفره در آدینه یا تورنمنت: بازیکن یارش را انتخاب می‌کند و ورودی هر دو نفر را یک‌جا می‌دهد
      registerEvent(ev, method, partner) {
        let out
        commit((s) => {
          const cur = s.club.events.find((e) => e.id === ev.id)
          // partner.solo: بدون یار ثبت‌نام می‌کند و مدیر برایش یار هم‌سطح می‌گذارد
          const solo = !!partner?.solo, n = solo ? 1 : 2
          const ids = [ME, solo ? null : partner?.id].filter(Boolean)
          if (!cur || !partner || cur.status !== 'open' || cur.regs.length + n > cur.cap || cur.regs.some((r) => ids.includes(r.by)) || (cur.levels?.length && (!cur.levels.includes(s.user?.level) || (!solo && !cur.levels.includes(partner.level))))) { out = { error: 'closed' }; return s }
          const total = cur.fee * n, now = Date.now(), pair = solo ? null : 'p' + now
          const me = s.user?.name || 'کاربر اپ'
          const sale = { id: 'S-' + now, kind: 'event', item: ev.id, name: solo ? `${cur.title}، ${me.split(' ')[0]} (منتظر یار)` : `${cur.title}، تیم ${me.split(' ')[0]} و ${partner.name.split(' ')[0]}`, by: ME, price: total, method, at: now }
          const base = { at: now, method, paid: cur.fee, source: 'app', sale: sale.id, ...(solo ? { waiting: true } : { pair, payer: ME }) }
          const regs = [
            { ...base, id: 'r' + now, by: ME, name: me, level: s.user?.level, phone: s.user?.phone },
            ...(solo ? [] : [{ ...base, id: 'r' + now + 'b', by: partner.id, name: partner.name, level: partner.level || null }]),
          ]
          const r = reward(pay(s, total, method), 80, ['champ'])
          out = r.result
          const events = s.club.events.map((e) => (e.id === ev.id ? { ...e, regs: [...e.regs, ...regs] } : e))
          return { ...r.next, events: [...s.events, ev.id], club: { ...s.club, events, sales: [sale, ...s.club.sales] } }
        })
        return out
      },
      // پکیج چندجلسه‌ای: همه‌ی جلسه‌ها همین حالا در تقویم رزرو می‌شوند و یک فروش ثبت می‌شود
      bookSeries(list, sale, method) {
        let out
        commit((s) => {
          const sid = 'P' + Date.now()
          // بررسی دوباره‌ی آزاد بودن، تا اگر بین برنامه‌ریزی و پرداخت پر شده باشد رزرو تکراری ثبت نشود
          const clash = list.find((x) => !isFree(s.club, x.date, x.court, x.start, x.dur) ||
            (x.coach && s.club.bookings.some((b) => b.coach === x.coach && b.date === x.date && b.status !== 'cancelled' && x.start < b.start + b.dur && b.start < x.start + x.dur)))
          if (clash) { out = { error: clash }; return s }
          const recs = list.map((x, k) => ({ id: `${sid}-${k}`, by: ME, status: 'ok', source: 'app', at: Date.now(), method: 'package', series: sid, levels: null, ...x, paid: x.price }))
          const bookings = [...s.club.bookings, ...recs]
          const saleRec = { id: 'S-' + Date.now(), kind: sale.kind, item: sale.item, pack: sale.pack, series: sid, name: sale.name, by: ME, price: sale.total, method, at: Date.now() }
          const r = reward(pay(s, sale.total, method), 40 + list.length * 15, [
            'first', 'loyal', sale.kind === 'coach' && 'student', list.some((x) => x.start < 9) && 'early',
            list.some((x) => x.start + x.dur > 22) && 'night', myCourts(bookings).size >= 4 && 'quad',
          ])
          out = { ...r.result, count: recs.length, series: sid }
          return { ...r.next, club: { ...s.club, bookings, sales: [saleRec, ...s.club.sales] } }
        })
        return out
      },
      buyPackage(p, method) {
        let out
        commit((s) => {
          const sale = { id: 'S-' + Date.now(), kind: 'package', item: p.id, name: p.name, by: ME, price: p.price, method, at: Date.now() }
          const base = pay(s, p.price, method)
          const withPkg = { ...base, membership: { id: p.id, until: Date.now() + p.days * 864e5 } }
          const r = reward(withPkg, 60, ['loyal'])
          out = r.result
          return { ...r.next, club: { ...s.club, sales: [sale, ...s.club.sales] } }
        })
        return out
      },
      topUp(n) { commit((s) => ({ ...s, wallet: s.wallet + n })) },

      // سبد خرید
      addToCart(item) {
        commit((s) => {
          const k = s.cart.findIndex((x) => x.pid === item.pid && x.size === item.size && x.color === item.color)
          const cart = k < 0 ? [...s.cart, item] : s.cart.map((x, i) => (i === k ? { ...x, qty: x.qty + item.qty } : x))
          return { ...s, cart }
        })
      },
      setQty(i, qty) { commit((s) => ({ ...s, cart: qty <= 0 ? s.cart.filter((_, k) => k !== i) : s.cart.map((x, k) => (k === i ? { ...x, qty } : x)) })) },
      toggleWish(pid) { commit((s) => ({ ...s, wish: s.wish.includes(pid) ? s.wish.filter((x) => x !== pid) : [...s.wish, pid] })) },
      checkout(method) {
        let out
        commit((s) => {
          const items = s.cart.map((x) => { const p = productById(x.pid); return { ...x, price: p.price, cost: p.cost, sku: variantOf(p, x.size, x.color)?.sku } })
          const total = items.reduce((a, x) => a + x.qty * x.price, 0)
          const order = { id: 'Q-' + String(Date.now()).slice(-5), by: ME, items, total, method, status: 'new', source: 'app', at: Date.now() }
          const r = reward(pay({ ...s, cart: [] }, total, method), Math.max(10, Math.round(total / 200000)), ['shopper'])
          out = { ...r.result, order }
          return { ...r.next, club: { ...s.club, orders: [order, ...s.club.orders], products: takeStock(s.club.products, items) } }
        })
        return out
      },
      // کافه — سبد جدا از فروشگاه؛ تحویل در کافه یا سر زمین
      cafeAdd(item) {
        commit((s) => {
          const cart = s.cafeCart || []
          const k = cart.findIndex((x) => x.iid === item.iid && !!x.big === !!item.big && (x.note || '') === (item.note || ''))
          return { ...s, cafeCart: k < 0 ? [...cart, item] : cart.map((x, i) => (i === k ? { ...x, qty: x.qty + item.qty } : x)) }
        })
      },
      cafeQty(i, qty) { commit((s) => ({ ...s, cafeCart: qty <= 0 ? s.cafeCart.filter((_, k) => k !== i) : s.cafeCart.map((x, k) => (k === i ? { ...x, qty } : x)) })) },
      cafeCheckout(method, to) {
        let out
        commit((s) => {
          // ممکن است از زمان افزودن به سبد، موجودی با سفارش‌های دیگر کم شده باشد
          if (!fits(s.club.cafeIngs, s.club.cafeItems, s.cafeCart)) { out = { error: 'stock' }; return s }
          const r = placeCafe(s.club.cafeIngs, s.club.cafeItems, s.cafeCart)
          const order = { id: 'K-' + String(Date.now()).slice(-5), by: ME, items: r.lines, use: r.use, total: r.total, method, to: to || null, status: 'new', source: 'app', at: Date.now() }
          const g = reward(pay({ ...s, cafeCart: [] }, r.total, method), Math.max(5, Math.round(r.total / 100000)), [])
          out = { ...g.result, order }
          return { ...g.next, club: { ...s.club, cafeOrders: [order, ...s.club.cafeOrders], cafeIngs: r.ings } }
        })
        return out
      },
      claimQuest(id, xp) {
        let out
        commit((s) => {
          const wk = weekKey()
          const r = reward({ ...s, quests: { ...s.quests, [wk]: [...(s.quests[wk] || []), id] } }, xp, [])
          out = r.result
          return r.next
        })
        return out
      },

      notify(n) { commit((s) => ({ ...s, notifications: [{ id: 'n' + Date.now() + Math.random(), at: Date.now(), read: false, ...n }, ...s.notifications].slice(0, 60) })) },
      readAll() { commit((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) })) },

      // ---------- مدیر ----------
      // عضو تازه از پذیرش
      adminMember(m) {
        let id
        club((c) => {
          id = 'd' + Date.now()
          return { ...c, members: [...(c.members || []), { id, games: 0, wins: 0, points: levelById(m.level).base, joined: 0, at: Date.now(), source: 'desk', member: null, ...m }] }
        })
        return id
      },
      // ویرایش عضو: عضو ثبت‌شده در پذیرش مستقیم، عضو نمونه با club.memberEdits
      adminMemberEdit(id, patch) {
        club((c) => {
          if ((c.members || []).some((m) => m.id === id)) return { ...c, members: c.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }
          return { ...c, memberEdits: { ...(c.memberEdits || {}), [id]: { ...(c.memberEdits?.[id] || {}), ...patch } } }
        })
      },
      // مربی جدید یا ویرایش؛ بخش «نمایش در اپ» و «فقط مدیر» در یک رکورد، ولی اپ فقط بخش عمومی را نشان می‌دهد
      adminCoachSave(co) {
        let saved
        club((c) => {
          const old = c.coaches.find((x) => x.id === co.id)
          saved = old ? { ...old, ...co } : { active: true, packs: { one: true, five: true, ten: true, group: true }, prices: {}, record: [], ...co, id: 'k' + Date.now() }
          return { ...c, coaches: old ? c.coaches.map((x) => (x.id === old.id ? saved : x)) : [...c.coaches, saved] }
        })
        return saved
      },
      adminAddBooking(b) { club((c) => ({ ...c, bookings: [...c.bookings, { id: 'd' + Date.now(), status: 'ok', source: 'desk', at: Date.now(), ...b }] })) },
      // تسویه: مبلغ و زمان پرداخت جدا ثبت می‌شود تا سند حسابداری در همان روز بخورد
      // دریافت دستی در پذیرش (نقدی یا کارتخوان)؛ در دریافت‌ها، داشبورد و حسابداری دیده می‌شود
      adminReview(id, patch) { club((c) => ({ ...c, reviews: (c.reviews || []).map((r) => (r.id === id ? { ...r, ...patch } : r)) })) },
      adminPayin(p) { club((c) => ({ ...c, payins: [{ id: 'PI' + Date.now(), at: Date.now(), date: todayKey(), ...p }, ...(c.payins || [])] })) },
      adminPayinDel(id) { club((c) => ({ ...c, payins: (c.payins || []).filter((p) => p.id !== id) })) },
      adminSettle(id, method) {
        club((c) => ({ ...c, bookings: c.bookings.map((b) => (b.id === id && b.paid < b.price
          ? { ...b, paid: b.price, method: b.method || method, settled: [...(b.settled || []), { amt: b.price - b.paid, at: Date.now(), method }] } : b)) }))
      },
      adminCancel(id, refund) { club((c) => ({ ...c, bookings: c.bookings.map((b) => (b.id === id ? { ...b, status: 'cancelled', refunded: refund && b.paid > 0 } : b)) })) },
      adminMove(id, patch) { club((c) => ({ ...c, bookings: c.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) })) },
      adminOrder(id, status) { club((c) => ({ ...c, orders: c.orders.map((o) => (o.id === id ? { ...o, status } : o)) })) },
      // ---------- فروشگاه و انبار ----------
      adminProduct(p) {
        let saved
        club((c) => {
          const old = c.products.find((x) => x.id === p.id)
          const code = old?.code || nextCode(c.products, p.cat)
          saved = { ...old, ...p, id: old?.id || 'p' + Date.now(), code, active: p.active ?? true }
          saved.variants = makeVariants(saved, old?.variants)
          return { ...c, products: old ? c.products.map((x) => (x.id === old.id ? saved : x)) : [...c.products, saved] }
        })
        return saved
      },
      // اصلاح موجودی یک SKU (کسری یا اضافه) — سند حسابداری با بهای میانگین
      adminAdjust(pid, sku, delta, note = '') {
        club((c) => {
          const p = c.products.find((x) => x.id === pid), v = p.variants.find((x) => x.sku === sku)
          const qty = Math.max(-v.stock, delta)
          if (!qty) return c
          return {
            ...c, products: c.products.map((x) => (x.id !== pid ? x : { ...x, variants: x.variants.map((y) => (y.sku === sku ? { ...y, stock: y.stock + qty } : y)) })),
            stockMoves: [{ id: 'M' + Date.now(), date: todayKey(), kind: 'adjust', pid, code: p.code, sku, qty, cost: p.cost, note }, ...(c.stockMoves || [])],
          }
        })
      },
      // ورود کالا با فاکتور خرید؛ بهای هر کالا به روش میانگین موزون به‌روز می‌شود
      adminReceive(r) {
        club((c) => {
          const products = c.products.map((p) => {
            const lines = r.items.filter((x) => x.pid === p.id)
            if (!lines.length) return p
            const have = p.variants.reduce((s, v) => s + v.stock, 0), add = lines.reduce((s, x) => s + x.qty, 0)
            const cost = Math.round((have * p.cost + lines.reduce((s, x) => s + x.qty * x.cost, 0)) / (have + add))
            return { ...p, cost, variants: p.variants.map((v) => ({ ...v, stock: v.stock + lines.filter((x) => x.sku === v.sku).reduce((s, x) => s + x.qty, 0) })) }
          })
          const rec = { id: 'R-' + String(Date.now()).slice(-5), at: Date.now(), ...r, items: r.items.map((x) => ({ ...x, code: c.products.find((p) => p.id === x.pid).code })), total: r.items.reduce((s, x) => s + x.qty * x.cost, 0) }
          const suppliers = c.suppliers.includes(r.supplier) ? c.suppliers : [...c.suppliers, r.supplier]
          return { ...c, products, receipts: [rec, ...c.receipts], suppliers }
        })
      },
      // فروش حضوری در پذیرش — تحویل همان لحظه
      adminPos(items, method, by) {
        let order = null
        club((c) => {
          const enough = items.length > 0 && items.every((x) => x.qty > 0 && x.qty <= (c.products.find((p) => p.id === x.pid)?.variants.find((v) => v.sku === x.sku)?.stock || 0))
          if (!enough) return c
          const lines = items.map((x) => { const p = c.products.find((y) => y.id === x.pid); return { ...x, price: p.price, cost: p.cost } })
          order = { id: 'Q-' + String(Date.now()).slice(-5), by: by || 'walkin', items: lines, total: lines.reduce((s, x) => s + x.qty * x.price, 0), method, status: 'delivered', source: 'desk', at: Date.now() }
          return { ...c, orders: [order, ...c.orders], products: takeStock(c.products, lines) }
        })
        return order
      },
      adminApPay(p) { club((c) => ({ ...c, apPays: [{ id: 'AP' + Date.now(), date: todayKey(), ...p }, ...c.apPays] })) },
      // ---------- کافه ----------
      adminCafeItem(it) {
        let saved
        club((c) => {
          const old = c.cafeItems.find((x) => x.id === it.id)
          saved = { ...old, ...it, id: old?.id || 'k' + Date.now(), code: old?.code || nextItemCode(c.cafeItems, it.cat), active: it.active ?? true }
          return { ...c, cafeItems: old ? c.cafeItems.map((x) => (x.id === old.id ? saved : x)) : [...c.cafeItems, saved] }
        })
        return saved
      },
      adminCafeIng(g) {
        let saved
        club((c) => {
          const old = c.cafeIngs.find((x) => x.id === g.id)
          saved = { stock: 0, ...old, ...g, id: old?.id || 'g' + Date.now(), code: old?.code || nextIngCode(c.cafeIngs, g.cat), active: g.active ?? true }
          return { ...c, cafeIngs: old ? c.cafeIngs.map((x) => (x.id === old.id ? saved : x)) : [...c.cafeIngs, saved] }
        })
        return saved
      },
      // خرید مواد اولیه؛ مقدار و بها به واحد پایه (گرم / میلی‌لیتر / عدد)
      adminCafeReceive(r) {
        club((c) => {
          const items = r.items.map((x) => { const g = c.cafeIngs.find((y) => y.id === x.ing); return { ...x, code: g.code, name: g.name } })
          const rec = { id: 'CR-' + String(Date.now()).slice(-5), at: Date.now(), ...r, items, total: items.reduce((s, x) => s + Math.round(x.qty * x.cost), 0) }
          const suppliers = c.suppliers.includes(r.supplier) ? c.suppliers : [...c.suppliers, r.supplier]
          return { ...c, cafeIngs: receiveInto(c.cafeIngs, items), cafeReceipts: [rec, ...c.cafeReceipts], suppliers }
        })
      },
      // ضایعات (منفی) یا اضافه‌ی شمارش (مثبت) به واحد پایه
      adminCafeAdjust(id, delta, note = '') {
        club((c) => {
          const g = c.cafeIngs.find((x) => x.id === id)
          const qty = Math.max(-g.stock, delta), amount = Math.round(qty * g.cost)
          if (!qty) return c
          return {
            ...c, cafeIngs: c.cafeIngs.map((x) => (x.id === id ? { ...x, stock: Math.max(0, x.stock + qty) } : x)),
            cafeMoves: amount ? [{ id: 'CM' + Date.now(), date: todayKey(), ing: id, code: g.code, name: g.name, qty, amount, note }, ...c.cafeMoves] : c.cafeMoves,
          }
        })
      },
      adminCafeOrder(id, status) { club((c) => ({ ...c, cafeOrders: c.cafeOrders.map((o) => (o.id === id ? { ...o, status } : o)) })) },
      // سفارش حضوری؛ now = تحویل همان لحظه (مثلاً آب یا نوشابه)، وگرنه به صف آماده‌سازی می‌رود
      adminCafePos(lines, method, by, to, now = false) {
        let order = null
        club((c) => {
          if (!fits(c.cafeIngs, c.cafeItems, lines)) return c
          const r = placeCafe(c.cafeIngs, c.cafeItems, lines)
          order = { id: 'K-' + String(Date.now()).slice(-5), by: by || 'walkin', items: r.lines, use: r.use, total: r.total, method, to: to || null, status: now ? 'delivered' : 'prep', source: 'desk', at: Date.now() }
          return { ...c, cafeOrders: [order, ...c.cafeOrders], cafeIngs: r.ings }
        })
        return order
      },
      // ---------- آدینه‌ها و تورنمنت‌ها ----------
      adminEventSave(ev) {
        let saved
        club((c) => {
          const old = c.events.find((e) => e.id === ev.id)
          saved = old ? { ...old, ...ev } : { regs: [], teams: [], groups: [], matches: [], courts: [1, 2, 3, 4], note: '', ...ev, id: 'ev' + Date.now() }
          // زمین‌های انتخابی در همان روز و ساعت برای مسابقه بسته می‌شوند
          return { ...c, events: old ? c.events.map((e) => (e.id === old.id ? saved : e)) : [saved, ...c.events], bookings: syncBlocks(c.bookings, saved) }
        })
        return saved
      },
      // فقط رویدادی که ورودی پرداخت‌شده ندارد پاک می‌شود؛ بقیه «لغو» می‌شوند
      adminEventDel(id) { club((c) => ({ ...c, events: c.events.filter((e) => e.id !== id), bookings: c.bookings.filter((b) => b.event !== id) })) },
      // تغییر تیم‌ها، گروه‌ها و نتیجه‌ها با توابع events.js
      adminEventSet(id, fn) { club((c) => ({ ...c, events: c.events.map((e) => (e.id === id ? fn(e) : e)) })) },
      // ثبت‌نام حضوری؛ با یار، دو نفر یک تیم می‌شوند و نفر اول ورودی هر دو را می‌دهد (each = ورودی هر نفر)
      adminEventReg(id, p, method, each, partner) {
        club((c) => {
          const ev = c.events.find((e) => e.id === id), now = Date.now()
          const ps = [p, partner].filter(Boolean), total = each * ps.length
          const sale = total > 0 ? { id: 'S-' + now, kind: 'event', item: id, name: partner ? `${ev.title}، تیم ${p.name.split(' ')[0]} و ${partner.name.split(' ')[0]}` : ev.title, by: p.by, price: total, method, at: now } : null
          const regs = ps.map((x, i) => ({ id: 'r' + now + (i ? 'b' : ''), at: now, method: total > 0 ? method : 'free', paid: each, source: 'desk', sale: sale?.id || null, ...(partner ? { pair: 'p' + now, payer: p.by } : {}), ...x }))
          return { ...c, events: c.events.map((e) => (e.id === id ? { ...e, regs: [...e.regs, ...regs] } : e)), sales: sale ? [sale, ...c.sales] : c.sales }
        })
      },
      // حذف شرکت‌کننده = برگرداندن ورودی؛ اگر با یار ثبت‌نام کرده، هر دو با هم حذف می‌شوند
      adminEventUnreg(id, rid) {
        club((c) => {
          const ev = c.events.find((e) => e.id === id), reg = ev.regs.find((r) => r.id === rid)
          const gone = (r) => r.id === rid || (reg?.pair && r.pair === reg.pair)
          const next = { ...ev, regs: ev.regs.filter((r) => !gone(r)), teams: [], groups: [], matches: [] }
          return { ...c, events: c.events.map((e) => (e.id === id ? next : e)), sales: c.sales.filter((s) => s.id !== reg?.sale) }
        })
      },
      adminHours(h) { club((c) => ({ ...c, hours: h })) },
      adminPricing(p) { club((c) => ({ ...c, pricing: { ...c.pricing, ...p } })) },
      adminCourt(id, off) { club((c) => ({ ...c, off: { ...c.off, [id]: off } })) },
      // ---------- حسابداری ----------
      adminExpense(e) { club((c) => ({ ...c, expenses: [{ id: 'e' + Date.now(), at: Date.now(), ...e }, ...c.expenses] })) },
      adminExpenseDel(id) { club((c) => ({ ...c, expenses: c.expenses.filter((e) => e.id !== id) })) },
      adminJournal(j) { club((c) => ({ ...c, journals: [{ id: 'J' + Date.now(), at: Date.now(), ...j }, ...c.journals] })) },
      adminJournalDel(id) { club((c) => ({ ...c, journals: c.journals.filter((j) => j.id !== id) })) },

      // ---------- منابع انسانی ----------
      adminStaff(p) {
        let id = p.id
        club((c) => {
          if (id && c.staff.some((s) => s.id === id)) return { ...c, staff: c.staff.map((s) => (s.id === id ? { ...s, ...p } : s)) }
          id = 'h' + Date.now()
          return { ...c, staff: [...c.staff, { status: 'active', docs: {}, ...p, id }], shifts: { ...c.shifts, [id]: ['off', 'off', 'off', 'off', 'off', 'off', 'off'] } }
        })
        return id
      },
      adminShift(staffId, day, code) { club((c) => ({ ...c, shifts: { ...c.shifts, [staffId]: c.shifts[staffId].map((x, i) => (i === day ? code : x)) } })) },
      adminAttend(date, staffId, patch) {
        club((c) => {
          const day = { ...(c.attendance[date] || {}) }
          const rec = { ...(day[staffId] || {}), ...patch }
          if (rec.in == null) delete day[staffId]; else day[staffId] = rec
          return { ...c, attendance: { ...c.attendance, [date]: day } }
        })
      },
      adminLeave(l) { club((c) => ({ ...c, leaves: [{ id: 'L' + Date.now(), at: Date.now(), status: 'pending', ...l }, ...c.leaves] })) },
      adminLeaveStatus(id, status) { club((c) => ({ ...c, leaves: c.leaves.map((l) => (l.id === id ? { ...l, status } : l)) })) },
      adminAdvance(a) { club((c) => ({ ...c, advances: [{ id: 'A' + Date.now(), date: todayKey(), ...a }, ...c.advances] })) },
      adminHrCfg(p) { club((c) => ({ ...c, hrCfg: { ...c.hrCfg, ...p } })) },
      // ثبت سند حقوق یک ماه با تصویر محاسبه در همان لحظه
      adminPayroll(mk) {
        club((c) => (c.payrolls.some((p) => p.month === mk) ? c
          : { ...c, payrolls: [{ id: 'PR-' + mk, month: mk, label: jMonthLabel(mk), date: todayKey(), rows: payroll(c, mk), at: Date.now() }, ...c.payrolls] }))
      },
      adminPayrollPay(mk, field) { club((c) => ({ ...c, payrolls: c.payrolls.map((p) => (p.month === mk ? { ...p, [field]: todayKey() } : p)) })) },
      adminPayrollUndo(mk) { club((c) => ({ ...c, payrolls: c.payrolls.filter((p) => p.month !== mk || p.paidAt) })) },
      toast,
    }
  }, [toast])

  return <Ctx.Provider value={{ ...state, ...api, toasts }}>{children}</Ctx.Provider>
}

// کم کردن موجودی تنوع‌های فروخته‌شده
function takeStock(products, items) {
  return products.map((p) => {
    const lines = items.filter((x) => x.pid === p.id)
    if (!lines.length) return p
    return { ...p, variants: p.variants.map((v) => ({ ...v, stock: Math.max(0, v.stock - lines.filter((x) => (x.sku ? x.sku === v.sku : v === variantOf(p, x.size, x.color))).reduce((s, x) => s + x.qty, 0)) })) }
  })
}

// ---------- انتخاب‌گرهای مشترک ----------
export function busyOn(club, date, court) {
  return club.bookings.filter((b) => b.date === date && b.court === court && b.status !== 'cancelled')
}
export function isFree(club, date, court, start, dur) {
  if (club.off[court]) return false
  const { open, close } = hoursOf(club)
  if (start < open || start + dur > close) return false
  return !busyOn(club, date, court).some((b) => start < b.start + b.dur && b.start < start + dur)
}
export function freeStarts(club, date, court, dur, from = 0, to = 24) {
  const { open, close } = hoursOf(club)
  const now = new Date(), today = date === todayKey()
  const out = []
  for (let h = Math.max(open, from); h + dur <= close && h < to; h += 1) {
    if (today && h <= now.getHours() + now.getMinutes() / 60) continue
    if (isFree(club, date, court, h, dur)) out.push(h)
  }
  return out
}
export const courtsList = COURTS
