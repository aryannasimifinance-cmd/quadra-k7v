// مسابقات آدینه و تورنمنت‌ها: ثبت‌نام، تیم‌بندی متعادل، گروه‌ها، مرحله‌ی حذفی، برنده‌ها و فروش کافه‌ی همان روز
// همه‌ی داده در club.events ذخیره می‌شود تا مدیر تعریف و ویرایش کند و اپ همان را نشان دهد.
import { EV_IMG, FRIDAY, LEVELS, MEMBERS, OFFICIAL, addDays, dayKey, fromKey, hash, levelById, nextDays, todayKey } from './data'
import { dk } from './jalali'

export const EV_STATUS = { draft: ['پیش‌نویس', 'mute'], open: ['ثبت‌نام باز', 'ok'], closed: ['ثبت‌نام بسته', 'warn'], done: ['برگزار شد', 'mute'], cancelled: ['لغو شد', 'bad'] }
export const EV_FORMAT = { groups: 'گروهی + حذفی', knockout: 'فقط حذفی' }
export const ROUND = { 32: 'یک‌شانزدهم', 16: 'یک‌هشتم', 8: 'یک‌چهارم', 4: 'نیمه‌نهایی', 2: 'فینال' }
const GROUP_IDS = 'ABCDEFGH'

export const regPower = (r) => levelById(r.level)?.base || 1500
export const teamOf = (ev, id) => ev.teams.find((t) => t.id === id)
export const teamName = (ev, id) => teamOf(ev, id)?.name || '—'
export const isLive = (ev) => ev.status === 'open' || ev.status === 'closed'

// ---------- انتخاب‌ها ----------
export const upcoming = (club) => (club.events || []).filter((e) => isLive(e) && fromKey(e.date) >= fromKey(todayKey())).sort((a, b) => fromKey(a.date) - fromKey(b.date) || a.start - b.start)
export const finished = (club) => (club.events || []).filter((e) => e.status === 'done').sort((a, b) => fromKey(b.date) - fromKey(a.date))
// مسابقه‌ی همان روز: هر خرید کافه در روز آدینه یا مسابقه، فروش همان روز مسابقه است
export function eventAt(events, ts) {
  const k = dk(ts)
  return (events || []).find((e) => e.date === k && e.status !== 'draft' && e.status !== 'cancelled')
}
// برای اپ: رویدادهای پیش‌روی منتشرشده با شکل قبلی (format = متن توضیح، taken = تعداد ثبت‌نام)
export const asApp = (e) => ({ ...e, format: e.desc || EV_FORMAT[e.format], taken: e.regs.length })
export const appEvents = (club) => upcoming(club).map(asApp)
export const cafeOf = (club, ev) => (club.cafeOrders || []).filter((o) => eventAt([ev], o.at))
export const entryTotal = (ev) => ev.regs.reduce((s, r) => s + (r.paid || 0), 0)

// ---------- تیم‌بندی: قوی‌ترین با ضعیف‌ترین تا تیم‌ها هم‌سطح شوند ----------
const short = (n) => (n || '').split(' ')[0]
export function makeTeams(ev) {
  const teams = []
  const pairs = new Map()
  ev.regs.filter((r) => r.pair).forEach((r) => pairs.set(r.pair, [...(pairs.get(r.pair) || []), r.id]))
  ;[...pairs.values()].filter((p) => p.length === 2).forEach((p) => teams.push({ id: 't' + (teams.length + 1), players: p, pair: true }))
  const taken = new Set(teams.flatMap((x) => x.players))
  const regs = ev.regs.filter((r) => !taken.has(r.id)).sort((a, b) => regPower(b) - regPower(a))
  while (regs.length) {
    const a = regs.shift(), b = regs.pop()
    teams.push({ id: 't' + (teams.length + 1), players: b ? [a.id, b.id] : [a.id] })
  }
  return { ...ev, teams: teams.map((t) => named(ev, t)), groups: [], matches: [] }
}
function named(ev, t) {
  return { ...t, name: t.players.map((p) => short(ev.regs.find((r) => r.id === p)?.name)).join(' / ') }
}
const teamPower = (ev, t) => t.players.reduce((s, p) => s + regPower(ev.regs.find((r) => r.id === p) || {}), 0)
// جابه‌جا کردن دو بازیکن بین تیم‌ها (یا داخل یک تیم که اثری ندارد)
export function swapPlayers(ev, p1, p2) {
  const teams = ev.teams.map((t) => ({ ...t, players: t.players.map((p) => (p === p1 ? p2 : p === p2 ? p1 : p)) })).map((t) => named(ev, t))
  return { ...ev, teams }
}

// ---------- گروه‌ها: پخش ماری تیم‌ها به ترتیب قدرت، هر گروه دوره‌ای ----------
export function makeGroups(ev, opt = {}) {
  const teams = [...ev.teams].sort((a, b) => teamPower(ev, b) - teamPower(ev, a))
  const n = Math.max(1, Math.min(opt.groups || Math.round(teams.length / 4), Math.floor(teams.length / 2) || 1))
  const groups = Array.from({ length: n }, (_, i) => ({ id: GROUP_IDS[i], teams: [] }))
  teams.forEach((t, i) => { const row = Math.floor(i / n), col = row % 2 ? n - 1 - (i % n) : i % n; groups[col].teams.push(t.id) })
  const matches = []
  groups.forEach((g) => roundRobin(g.teams).forEach(([a, b], k) => matches.push({ id: `g${g.id}${k + 1}`, stage: 'group', group: g.id, a, b, sa: null, sb: null, court: ev.courts?.[k % (ev.courts?.length || 1)] || 1 })))
  const size = Math.min(...groups.map((g) => g.teams.length))
  return { ...ev, groups, matches, setup: { groups: n, advance: Math.min(opt.advance || (n === 1 ? Math.min(4, teams.length) : 2), size) } }
}
// پیش‌نمایش طرح مسابقه: چند تیم صعود می‌کنند و حذفی از کدام دور شروع می‌شود
export function plan(teams, groups, advance) {
  const per = Math.floor(teams / groups), extra = teams % groups
  const q = Math.min(teams, groups * advance)
  let size = 2; while (size < q) size *= 2
  const games = Array.from({ length: groups }, (_, i) => { const k = per + (i < extra ? 1 : 0); return (k * (k - 1)) / 2 }).reduce((a, b) => a + b, 0)
  return { per, extra, q, size, byes: size - q, games, koGames: size - 1 - (size - q) }
}
// روش دایره‌ای: در هر دور همه یک بار بازی می‌کنند و هیچ تیمی پشت سر هم بازی نمی‌کند
function roundRobin(ids) {
  const t = ids.length % 2 ? [...ids, null] : [...ids]
  const n = t.length, out = []
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) out.push([a, b]) }
    t.splice(1, 0, t.pop())
  }
  return out
}
export const scored = (m) => m.sa != null && m.sb != null && m.sa !== m.sb
export const winnerOf = (m) => (m.b == null ? m.a : scored(m) ? (m.sa > m.sb ? m.a : m.b) : null)
export const loserOf = (m) => (m.b == null || !scored(m) ? null : m.sa > m.sb ? m.b : m.a)

export function standings(ev, gid) {
  const g = ev.groups.find((x) => x.id === gid)
  const rows = g.teams.map((id) => ({ id, name: teamName(ev, id), p: 0, w: 0, l: 0, gf: 0, ga: 0 }))
  ev.matches.filter((m) => m.stage === 'group' && m.group === gid && scored(m)).forEach((m) => {
    const A = rows.find((r) => r.id === m.a), B = rows.find((r) => r.id === m.b)
    A.p++; B.p++; A.gf += m.sa; A.ga += m.sb; B.gf += m.sb; B.ga += m.sa
    if (m.sa > m.sb) { A.w++; B.l++ } else { B.w++; A.l++ }
  })
  // برد، بعد تفاضل گیم، بعد گیم زده، بعد بازی رودررو
  return rows.sort((a, b) => b.w - a.w || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || h2h(ev, a.id, b.id))
}
function h2h(ev, a, b) {
  const m = ev.matches.find((x) => x.stage === 'group' && ((x.a === a && x.b === b) || (x.a === b && x.b === a)))
  const w = m && winnerOf(m)
  return w === a ? -1 : w === b ? 1 : 0
}
export const groupsDone = (ev) => ev.groups.length > 0 && ev.matches.filter((m) => m.stage === 'group').every(scored)

// ---------- مرحله‌ی حذفی: سیدها ۱ با آخر، ۲ با یکی مانده به آخر و … ؛ جای خالی = استراحت (bye) ----------
export function makeKnockout(ev, perGroup) {
  let seeds
  if (ev.format === 'knockout' || !ev.groups.length) seeds = [...ev.teams].sort((a, b) => teamPower(ev, b) - teamPower(ev, a)).map((t) => t.id)
  else {
    const tables = ev.groups.map((g) => standings(ev, g.id))
    const per = Math.min(perGroup ?? ev.setup?.advance ?? (ev.groups.length === 1 ? 4 : 2), ...tables.map((x) => x.length))
    seeds = []
    // اول‌های گروه‌ها سیدهای بالا، دوم‌ها پایین؛ ترتیب جدول، اول هر گروه را به دوم گروه دیگر می‌رساند
    for (let k = 0; k < per; k++) tables.forEach((t) => t[k] && seeds.push(t[k].id))
  }
  let size = 2; while (size < seeds.length) size *= 2
  const slots = order(size)
  const matches = []
  for (let i = 0; i < size / 2; i++) {
    const a = seeds[slots[2 * i] - 1] ?? null, b = seeds[slots[2 * i + 1] - 1] ?? null
    matches.push({ id: `k${size}-${i + 1}`, stage: 'ko', round: size, idx: i, a: a ?? b, b: a == null ? null : b, sa: null, sb: null })
  }
  return advance({ ...ev, matches: [...ev.matches.filter((m) => m.stage === 'group'), ...matches] })
}
// ترتیب استاندارد جدول حذفی تا سید ۱ و ۲ فقط در فینال به هم برسند
function order(size) {
  let s = [1, 2]
  while (s.length < size) { const n = s.length * 2 + 1; s = s.flatMap((x) => [x, n - x]) }
  return s
}
// اگر یک دور کامل شد، دور بعد ساخته می‌شود
export function advance(ev) {
  let out = ev
  for (;;) {
    const ko = out.matches.filter((m) => m.stage === 'ko')
    if (!ko.length) return out
    const last = Math.min(...ko.map((m) => m.round))
    const cur = ko.filter((m) => m.round === last).sort((a, b) => a.idx - b.idx)
    if (last <= 2 || !cur.every((m) => winnerOf(m))) return out
    const next = []
    for (let i = 0; i < cur.length; i += 2) next.push({ id: `k${last / 2}-${i / 2 + 1}`, stage: 'ko', round: last / 2, idx: i / 2, a: winnerOf(cur[i]), b: winnerOf(cur[i + 1]), sa: null, sb: null })
    out = { ...out, matches: [...out.matches, ...next] }
  }
}
// ثبت نتیجه؛ اگر نتیجه‌ی یک دور حذفی عوض شود، دورهای بعدش از نو ساخته می‌شوند
export function setScore(ev, id, sa, sb) {
  const m = ev.matches.find((x) => x.id === id)
  let matches = ev.matches.map((x) => (x.id === id ? { ...x, sa, sb } : x))
  if (m.stage === 'ko') matches = matches.filter((x) => x.stage !== 'ko' || x.round >= m.round)
  return advance({ ...ev, matches })
}
export function podium(ev) {
  const fin = ev.matches.find((m) => m.stage === 'ko' && m.round === 2)
  if (!fin || !winnerOf(fin)) return null
  const semis = ev.matches.filter((m) => m.stage === 'ko' && m.round === 4).map(loserOf).filter(Boolean)
  return { first: winnerOf(fin), second: loserOf(fin), third: semis }
}
export const koRounds = (ev) => [...new Set(ev.matches.filter((m) => m.stage === 'ko').map((m) => m.round))].sort((a, b) => b - a)

// ---------- زمین‌های مسابقه در تقویم ----------
export const blocksOf = (ev) => (ev.status === 'draft' || ev.status === 'cancelled' ? [] : ev.courts.map((c) => ({
  id: `ev-${ev.id}-${c}`, court: c, date: ev.date, start: ev.start, dur: ev.dur, type: 'block', note: `🏆 ${ev.title}`, event: ev.id,
  by: null, players: [], price: 0, paid: 0, status: 'ok', source: 'desk', at: Date.now(),
})))
// رزروهای این مسابقه جایگزین قبلی‌ها می‌شوند
export const syncBlocks = (bookings, ev) => [...bookings.filter((b) => b.event !== ev.id), ...blocksOf(ev)]
// رزروهای عادی که با ساعت مسابقه روی زمین‌های انتخابی هم‌پوشانی دارند
export const clashes = (bookings, ev) => bookings.filter((b) => b.event !== ev.id && b.status !== 'cancelled' && b.date === ev.date && ev.courts.includes(b.court) && b.start < ev.start + ev.dur && ev.start < b.start + b.dur)

// ---------- داده‌ی نمونه ----------
const rh = (x) => hash(x + '#ev')
function fakeRegs(id, n, fee, date) {
  const pool = [...MEMBERS].sort((a, b) => rh(id + a.id) - rh(id + b.id)).slice(0, n)
  const at0 = fromKey(date).getTime() - 6 * 864e5
  return pool.map((m, i) => {
    const j = i - (i % 2)
    return { id: `r${i + 1}`, by: m.id, name: m.name, level: m.level, phone: m.phone, at: at0 + j * 36e5 * 3, method: rh(id + 'pm' + j) < 0.6 ? 'online' : rh(id + 'pm2' + j) < 0.5 ? 'card' : 'cash', paid: fee, source: rh(id + 's' + j) < 0.7 ? 'app' : 'desk', ...(i + 1 < n || i % 2 ? { pair: `${id}-p${j}`, payer: pool[j].id } : {}) }
  })
}
// نتیجه‌ی یک بازی تک‌ستی ۶ گیمی؛ تیم قوی‌تر شانس بیشتری دارد
function play(ev, m, key) {
  const pa = teamPower(ev, teamOf(ev, m.a)), pb = teamPower(ev, teamOf(ev, m.b))
  const aWins = rh(key) < 0.5 + Math.max(-0.3, Math.min(0.3, (pa - pb) / 1500))
  const lose = Math.floor(rh(key + 'l') * 5)
  return aWins ? [6, lose] : [lose, 6]
}
function runAll(ev) {
  let e = ev
  e.matches.filter((m) => m.stage === 'group').forEach((m) => { const [a, b] = play(e, m, e.id + m.id); e = setScore(e, m.id, a, b) })
  e = makeKnockout(e)
  for (let guard = 0; guard < 8; guard++) {
    const open = e.matches.find((m) => m.stage === 'ko' && m.b != null && !scored(m))
    if (!open) break
    const [a, b] = play(e, open, e.id + open.id); e = setScore(e, open.id, a, b)
  }
  return e
}

export function seedEvents() {
  const out = [], sales = []
  const today = todayKey()
  const base = (o) => ({ courts: [1, 2, 3, 4], regs: [], teams: [], groups: [], matches: [], note: '', ...o })
  // آدینه‌های گذشته با نتیجه‌ی کامل
  const pastF = []
  for (let d = -1; d >= -50 && pastF.length < 6; d--) { const k = addDays(today, d); if (fromKey(k).getDay() === 5) pastF.push(k) }
  pastF.forEach((k, i) => {
    const f = FRIDAY[i % FRIDAY.length]
    let ev = base({ id: 'fr-' + k, kind: 'friday', title: i === 0 ? 'آدینه‌ی کوادرا' : f.title, desc: f.format, format: 'groups', date: k, start: 9, dur: 3, levels: LEVELS.slice(2, 6).map((l) => l.id), cap: 16, fee: 750000, prize: 'راکت Volt + توپ', img: EV_IMG[i % EV_IMG.length], status: 'done' })
    ev.regs = fakeRegs(ev.id, 12 + 2 * Math.floor(rh(k) * 3), ev.fee, k)
    out.push(runAll(makeGroups(makeTeams(ev))))
  })
  const off = (() => { for (let d = -9; d >= -20; d--) { const k = addDays(today, d); if (fromKey(k).getDay() === 4) return k } return addDays(today, -12) })()
  let cup = base({ id: 'of-' + off, kind: 'official', title: 'جام ماهانه‌ی کوادرا', desc: 'گروهی + حذفی، امتیاز رنکینگ کوادرا', format: 'groups', date: off, start: 10, dur: 8, levels: LEVELS.slice(0, 5).map((l) => l.id), cap: 32, fee: 1500000, prize: 'جایزه‌ی نقدی + جام', img: EV_IMG[4], status: 'done' })
  cup.regs = fakeRegs(cup.id, 24, cup.fee, off)
  out.push(runAll(makeGroups(makeTeams(cup))))
  // پیش‌رو: چهار آدینه‌ی بعدی و دو تورنمنت رسمی، با ثبت‌نام‌های تا امروز
  nextDays(28, 1).filter((d) => d.getDay() === 5).slice(0, 4).forEach((d, i) => {
    const k = dayKey(d), lv = Math.floor(rh('lv' + k) * 5)
    const f = i === 0 ? { ...FRIDAY[0], title: 'آدینه‌ی این هفته‌ی کوادرا' } : FRIDAY[i % FRIDAY.length]
    const ev = base({ id: 'fr-' + k, kind: 'friday', title: f.title, desc: f.format, format: 'groups', date: k, start: 9, dur: 3, levels: LEVELS.slice(lv, lv + 3).map((l) => l.id), cap: 16, fee: 750000, prize: 'راکت Volt + توپ', img: EV_IMG[i % EV_IMG.length], status: 'open' })
    ev.regs = fakeRegs(ev.id, Math.floor(16 * (0.35 + rh('tk' + i) * 0.45)), ev.fee, k).map((r) => ({ ...r, at: Math.min(r.at, Date.now() - (i + 1) * 36e5) }))
    out.push(ev)
  })
  OFFICIAL.forEach((o, i) => {
    const d = nextDays(7, o.in).find((x) => x.getDay() === 4), k = dayKey(d)
    const ev = base({ id: 'of-' + k, kind: 'official', title: o.title, desc: o.format, format: 'groups', date: k, start: 10, dur: 8, levels: LEVELS.slice(0, 5).map((l) => l.id), cap: 32, fee: 1500000, prize: o.prize, img: EV_IMG[(i + 3) % EV_IMG.length], status: 'open' })
    ev.regs = fakeRegs(ev.id, Math.floor(32 * (0.3 + rh('of' + i) * 0.35)), ev.fee, k).map((r) => ({ ...r, at: Math.min(r.at, Date.now() - (i + 2) * 36e5) }))
    out.push(ev)
  })
  // هر تیم یک فروش «رویداد» در حسابداری است (کسی که پرداخت کرده، ورودی هر دو نفر)
  out.forEach((ev) => {
    const seen = new Map()
    ev.regs.forEach((r) => {
      const key = r.pair || r.id
      if (!seen.has(key)) {
        const id = `S-E${ev.id}-${r.id}`, both = ev.regs.filter((x) => (x.pair || x.id) === key)
        seen.set(key, id)
        sales.push({ id, kind: 'event', item: ev.id, name: both.length > 1 ? `${ev.title}، تیم ${both.map((x) => x.name.split(' ')[0]).join(' و ')}` : ev.title, by: r.payer || r.by, price: both.reduce((s, x) => s + x.paid, 0), method: r.method, at: r.at })
      }
      r.sale = seen.get(key)
    })
  })
  return { events: out, sales }
}
// داده‌ی قبلی بدون رویداد: یک بار رویدادهای نمونه اضافه می‌شود؛ زمین‌های مسابقه‌های پیش‌رو هم در تقویم بسته می‌شوند
export function withEvents(club) {
  let c = club
  if (!c.events) { const { events, sales } = seedEvents(); c = { ...c, events, sales: [...sales, ...c.sales].sort((a, b) => b.at - a.at) } }
  if (c.evBlocks) return c
  // رزروهای نمونه‌ای که با ساعت مسابقه تداخل دارند کنار می‌روند (رزروهای خود کاربر می‌مانند)
  let bookings = c.bookings
  c.events.filter((e) => isLive(e) && fromKey(e.date) >= fromKey(todayKey())).forEach((e) => {
    const drop = new Set(clashes(bookings, e).filter((b) => b.by !== 'me' && !b.event).map((b) => b.id))
    bookings = syncBlocks(bookings.filter((b) => !drop.has(b.id)), e)
  })
  return { ...c, bookings, evBlocks: true }
}
