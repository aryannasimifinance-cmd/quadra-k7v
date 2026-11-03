import { COACHES, COURTS, MEMBERS, ratingOf, addDays, dayMonth, coachById, courtById, fromKey, memberById, productById, range, todayKey } from '../../data'
import { ME, payState } from '../../store'

export const SERIES = [
  { id: 'court', name: 'زمین', color: '#0E9F98' },
  { id: 'coach', name: 'کلاس مربی', color: '#5B6CF0' },
  { id: 'pack', name: 'پکیج و تورنمنت', color: '#E07B39' },
  { id: 'shop', name: 'فروشگاه', color: '#B44C9A' },
]
export const STATUS = {
  paid: { name: 'پرداخت‌شده', cls: 'ok' }, partial: { name: 'بخشی پرداخت‌شده', cls: 'warn' }, pending: { name: 'پرداخت‌نشده', cls: 'bad' },
  refunded: { name: 'مسترد', cls: 'mute' }, void: { name: 'لغو', cls: 'mute' },
}
export const OPEN_H = 17 // ساعت‌های کاری روزانه (۷ تا ۲۴)

export function who(id, user) {
  if (!id) return '—'
  if (id === ME) return user?.name ? `${user.name} (اپ)` : 'کاربر اپ'
  if (id === 'walkin') return 'مشتری حضوری'
  if (id.startsWith('f:')) return id.slice(2) + ' (مهمان)'
  return memberById(id)?.name || id
}

// همه‌ی تراکنش‌ها — رزروهایی که با اعتبار پکیج ثبت شده‌اند درآمد جدا ندارند (در فروش پکیج حساب شده)
export function payments(club, user) {
  const out = []
  club.bookings.forEach((b) => {
    if (b.type === 'block' || b.method === 'package' || b.method === 'coach-pack') return
    const st = payState(b)
    out.push({
      id: b.id, ref: b, at: fromKey(b.date).getTime() + b.start * 36e5, kind: b.type === 'coach' ? 'coach' : 'court',
      title: b.type === 'coach' ? `کلاس ${coachById(b.coach)?.name}` : `${courtById(b.court).name}، ${b.type === 'open' ? 'بازی باز' : 'رزرو زمین'}`,
      sub: `${dayMonth(fromKey(b.date))}، ${range(b.start, b.dur)}`, who: who(b.by, user), amount: b.price, paid: st === 'refunded' ? 0 : b.paid,
      due: st === 'paid' || st === 'void' || st === 'refunded' ? 0 : b.price - b.paid, method: b.method, status: st,
    })
  })
  club.orders.forEach((o) => out.push({ id: o.id, at: o.at, kind: 'shop', title: `سفارش ${o.id}`, sub: o.items.map((x) => productById(x.pid)?.name).join('، '), who: who(o.by, user), amount: o.total, paid: o.total, due: 0, method: o.method, status: 'paid' }))
  ;(club.cafeOrders || []).forEach((o) => out.push({ id: o.id, at: o.at, kind: 'cafe', title: `کافه ${o.id}`, sub: o.items.map((x) => x.name).join('، '), who: who(o.by, user), amount: o.total, paid: o.total, due: 0, method: o.method, status: 'paid' }))
  club.sales.forEach((s) => out.push({ id: s.id, at: s.at, kind: s.kind === 'coach' ? 'coach' : 'pack', title: s.name, sub: s.kind === 'event' ? 'ثبت‌نام تورنمنت' : s.kind === 'coach' ? 'پکیج مربی' : 'پکیج / عضویت', who: who(s.by, user), amount: s.price, paid: s.price, due: 0, method: s.method, status: 'paid' }))
  return out.sort((a, b) => b.at - a.at)
}

export function revenueByDay(pays, days = 30) {
  const keys = Array.from({ length: days }, (_, i) => addDays(todayKey(), i - days + 1))
  const map = Object.fromEntries(keys.map((k) => [k, { court: 0, coach: 0, pack: 0, shop: 0 }]))
  const end = fromKey(todayKey()).getTime() + 864e5
  pays.forEach((p) => {
    if (p.at >= end || !p.paid) return
    const d = new Date(p.at), k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    if (map[k]) map[k][p.kind] += p.paid
  })
  return keys.map((k) => ({ key: k, ...map[k], total: map[k].court + map[k].coach + map[k].pack + map[k].shop }))
}

export function occupancy(club, date, court) {
  const hrs = club.bookings.filter((b) => b.date === date && b.status !== 'cancelled' && (!court || b.court === court)).reduce((s, b) => s + b.dur, 0)
  return hrs / (OPEN_H * (court ? 1 : COURTS.length))
}

// میانگین اشغال ۴ هفته‌ی اخیر — روز هفته × ساعت
export function heat(club) {
  const grid = Array.from({ length: 7 }, () => Array(17).fill(0))
  for (let d = -28; d < 0; d++) {
    const k = addDays(todayKey(), d), wd = (fromKey(k).getDay() + 1) % 7 // شنبه = ۰
    club.bookings.forEach((b) => {
      if (b.date !== k || b.status === 'cancelled') return
      for (let t = b.start; t < b.start + b.dur; t += 0.5) { const h = Math.floor(t) - 7; if (h >= 0 && h < 17) grid[wd][h] += 0.5 / 4 / 4 }
    })
  }
  return grid
}

// جلسه‌های پکیج درآمد جدا ندارند؛ مبلغشان در فروش پکیج حساب شده
const notPack = (b) => b.method !== 'package' && b.method !== 'coach-pack'

export function memberStats(club, user) {
  const rows = MEMBERS.filter((m) => !(user && m.source === 'app' && m.phone === user.phone)).map((m) => {
    const bk = club.bookings.filter((b) => b.status !== 'cancelled' && (b.by === m.id || b.players?.includes(m.id)))
    const spent = bk.filter((b) => b.by === m.id && notPack(b)).reduce((s, b) => s + b.paid, 0) + club.orders.filter((o) => o.by === m.id).reduce((s, o) => s + o.total, 0) + club.sales.filter((x) => x.by === m.id).reduce((s, x) => s + x.price, 0)
    const lastB = bk.map((b) => fromKey(b.date).getTime()).filter((t) => t <= Date.now()).sort((a, b) => b - a)[0]
    const lastDays = lastB ? Math.floor((Date.now() - lastB) / 864e5) : 99
    const seg = m.member ? 'vip' : m.source || m.joined < 30 ? 'new' : lastDays > 10 ? 'risk' : 'active'
    return { ...m, visits: bk.length, spent, lastDays, seg, source: m.source || 'seed' }
  })
  if (user) {
    const bk = club.bookings.filter((b) => b.status !== 'cancelled' && (b.by === ME || b.players?.includes(ME)))
    rows.unshift({ id: ME, name: user.name + ' (اپ)', phone: user.phone, level: user.level, games: bk.length, visits: bk.length, wins: 0, points: 0, joined: 0, source: 'app', spent: bk.filter((b) => b.by === ME && notPack(b)).reduce((s, b) => s + b.paid, 0) + club.orders.filter((o) => o.by === ME).reduce((s, o) => s + o.total, 0) + club.sales.filter((x) => x.by === ME).reduce((s, x) => s + x.price, 0), lastDays: 0, seg: 'new', member: null })
  }
  return rows
}
export const SEGMENTS = { all: 'همه', vip: 'VIP / عضو', active: 'فعال', new: 'جدید', risk: 'در خطر ریزش' }

export function coachStats(club) {
  return COACHES.map((c) => {
    const bk = club.bookings.filter((b) => b.coach === c.id && b.status !== 'cancelled')
    const past = bk.filter((b) => fromKey(b.date) < fromKey(todayKey()))
    const sales = club.sales.filter((s) => s.kind === 'coach' && s.item === c.id)
    const rt = ratingOf(club, 'coach:' + c.id)
    return { ...c, rating: rt.avg, reviews: rt.count, comments: rt.list.filter((r, i, a) => r.text && a.findIndex((x) => x.text === r.text) === i).slice(0, 3), sessions: past.length, upcoming: bk.length - past.length, revenue: past.filter(notPack).reduce((s, b) => s + b.paid, 0) + sales.reduce((s, x) => s + x.price, 0), packs: sales.length }
  })
}

export const csv = (rows) => '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
export function download(name, text) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
