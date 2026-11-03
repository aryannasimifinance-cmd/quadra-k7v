// رزروها به شکل بُرد زمین: هر روز یک بخش، هر زمین یک ستون، هر رزرو یک کارت زمین کوچک با بازیکن‌ها
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { COURTS, TYPE_NAME, addDays, courtById, dayLabel, dayMonth, fa, fromKey, range, short, toman, todayKey } from '../../data'
import { payState, useStore } from '../../store'
import { Icon } from '../../components/ui'
import { jDate } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'
import { STATUS, who } from './derive'
import { Card, Empty, Search, Seg, Status, XlsxBtn } from './kit'

const RANGES = [['today', 'امروز', 'رزروهای امروز'], ['tomorrow', 'فردا', 'رزروهای فردا'], ['next', '۷ روز آینده', 'از امروز تا یک هفته‌ی بعد'], ['past', '۷ روز گذشته', 'بازی‌های هفته‌ی گذشته']]
const TYPES = [['private', 'رزرو زمین', 'کل زمین برای یک نفر و همراهانش؛ در اپ همان موقع کامل پرداخت می‌شود'], ['open', 'بازی باز', 'بازی که بقیه می‌توانند به آن بپیوندند'], ['coach', 'کلاس', 'کلاس با مربی'], ['block', 'تعمیرات', 'زمین برای تعمیر بسته است']]
const PAYS = [['paid', 'پرداخت‌شده', 'کامل پرداخت شده'], ['partial', 'بخشی پرداخت‌شده', 'فقط در بازی باز: بعضی بازیکن‌ها هنوز سهمشان را نداده‌اند'], ['pending', 'پرداخت‌نشده', 'رزرو پذیرش؛ موقع بازی در پذیرش پرداخت می‌شود'], ['void', 'لغوشده', 'رزروهای لغوشده']]
const SOURCES = [['app', 'اپ', 'رزرو از اپ'], ['desk', 'پذیرش', 'رزرو تلفنی یا حضوری']]
const nowH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 }

function Chips({ value, onChange, options, all = 'همه' }) {
  return (
    <div className="bk-chips">
      <button className={value === 'all' ? 'on' : ''} onClick={() => onChange('all')}>{all}</button>
      {options.map(([k, n, tip, cls]) => <button key={k} className={`${value === k ? 'on' : ''} ${cls || ''}`} onClick={() => onChange(value === k ? 'all' : k)} data-tip={tip}>{n}</button>)}
    </div>
  )
}

export function Bookings({ ctx }) {
  const { club, user } = useStore()
  const [rng, setRng] = useState('today')
  const [court, setCourt] = useState('all')
  const [type, setType] = useState('all')
  const [pay, setPay] = useState('all')
  const [src, setSrc] = useState('all')
  const [q, setQ] = useState('')
  const [more, setMore] = useState(false)
  const [view, setView] = useState('board')
  const t = todayKey()
  const days = useMemo(() => {
    if (rng === 'today') return [t]
    if (rng === 'tomorrow') return [addDays(t, 1)]
    if (rng === 'next') return Array.from({ length: 7 }, (_, i) => addDays(t, i))
    return Array.from({ length: 7 }, (_, i) => addDays(t, -1 - i))
  }, [rng, t])
  const list = useMemo(() => club.bookings.filter((b) => {
    if (!days.includes(b.date)) return false
    const st = payState(b)
    const ps = st === 'refunded' ? 'void' : st
    if (pay === 'all' ? b.status === 'cancelled' : ps !== pay) return false
    if (type !== 'all' && b.type !== type) return false
    return (court === 'all' || b.court === +court) && (src === 'all' || b.source === src)
      && (!q || who(b.by, user).includes(q) || b.players.some((p) => who(p, user).includes(q)))
  }), [club.bookings, days, court, type, pay, src, q, user])
  const sum = list.filter((b) => b.status !== 'cancelled').reduce((s, b) => ({ price: s.price + b.price, paid: s.paid + Math.min(b.paid, b.price) }), { price: 0, paid: 0 })
  const courts = court === 'all' ? COURTS : COURTS.filter((c) => c.id === +court)
  const extra = [type, pay, src].filter((x) => x !== 'all').length
  const active = extra + (court !== 'all') + (q ? 1 : 0)
  const reset = () => { setCourt('all'); setType('all'); setPay('all'); setSrc('all'); setQ('') }
  const exp = () => downloadXlsx('quadra-bookings', [{ name: 'رزروها', rows: table('رزروهای باشگاه کوادرا', ['تاریخ', 'ساعت', 'زمین', 'نوع', 'مشتری', 'بازیکن', 'منبع', 'مبلغ', 'دریافتی', 'مانده', 'وضعیت'],
    [...list].sort((a, b) => fromKey(a.date) - fromKey(b.date) || a.start - b.start).map((b) => [jDate(b.date), range(b.start, b.dur), courtById(b.court).name, TYPE_NAME[b.type], who(b.by, user), b.players.length, b.source === 'app' ? 'اپ' : 'پذیرش', b.price, b.paid, Math.max(0, b.price - b.paid), STATUS[payState(b)].name]),
    ['جمع', '', '', '', '', '', '', sum.price, sum.paid, sum.price - sum.paid, '']) }])

  return (
    <div className="stack">
      <div className="bk-filters">
        <div className="bk-row">
          <div className="bk-range">{RANGES.map(([k, n, tip]) => <button key={k} className={rng === k ? 'on' : ''} onClick={() => setRng(k)} data-tip={tip}>{rng === k && <motion.i layoutId="bk-rng" className="bk-rng-bg" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}<span>{n}</span></button>)}</div>
          <div className="bk-courts" data-tip="فقط رزروهای یک زمین">
            {[['all', 'همه‌ی زمین‌ها'], ...COURTS.map((c) => [String(c.id), c.name])].map(([k, n]) => <button key={k} className={court === k ? 'on' : ''} onClick={() => setCourt(k)}>{n}</button>)}
          </div>
          <Search value={q} onChange={setQ} ph="جستجوی نام" />
          <button className={`adm-btn ghost sm bk-more ${more || extra ? 'on' : ''}`} onClick={() => setMore(!more)} data-tip="فیلتر بر اساس نوع رزرو، پرداخت و منبع">
            <Icon name="filter" size={15} />فیلتر بیشتر{extra > 0 && <em>{fa(extra)}</em>}
          </button>
          <Seg value={view} onChange={setView} options={{ board: 'نمای زمین', list: 'نمای لیست' }} tips={{ board: 'هر زمین یک ستون، هر رزرو یک کارت', list: 'همه‌ی رزروها در یک فهرست مرتب‌شده بر اساس ساعت' }} />
          <XlsxBtn onClick={exp} label="اکسل" />
        </div>
        {more && (
          <motion.div className="bk-extra" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            <label><small>نوع</small><Chips value={type} onChange={setType} options={TYPES.map(([k, n, tip]) => [k, n, tip, `tp-${k}`])} /></label>
            <label><small>پرداخت</small><Chips value={pay} onChange={setPay} options={PAYS} /></label>
            <label><small>منبع</small><Chips value={src} onChange={setSrc} options={SOURCES} /></label>
            {active > 0 && <button className="link" onClick={reset}>پاک کردن همه</button>}
          </motion.div>
        )}
        <div className="bk-legend">
          <span><i className="lg tp-private" />رزرو زمین</span>
          <span><i className="lg tp-open" />بازی باز</span>
          <span><i className="lg tp-coach" />کلاس مربی</span>
          <span><i className="lg tp-block" />تعمیرات</span>
          <span className="sep" />
          <span data-tip="نوار پایین هر کارت"><i className="lg bar paid" />پرداخت کامل</span>
          <span data-tip="فقط در بازی باز"><i className="lg bar partial" />بخشی پرداخت‌شده</span>
          <span><i className="lg bar pending" />پرداخت‌نشده</span>
          <span className="sep" />
          <span><i className="lg dot" />بازیکن</span>
          <span data-tip="فقط در بازی باز"><i className="lg dot empty" />جای خالی</span>
          <span><i className="lg live" />در حال بازی</span>
        </div>
      </div>

      <div className="bk-sum">
        <div data-tip="رزروهای لغوشده حساب نمی‌شوند"><small>تعداد رزروها</small><b>{fa(list.filter((b) => b.status !== 'cancelled').length)}</b></div>
        <div data-tip="جمع قیمت همه‌ی این رزروها"><small>ارزش رزروها</small><b>{toman(sum.price)}</b></div>
        <div data-tip="پولی که از اپ یا در پذیرش گرفته شده"><small>تا الان دریافت شده</small><b className="ok">{toman(sum.paid)}</b></div>
        <div data-tip="باید در پذیرش گرفته شود؛ از بخش «دریافت‌ها» تسویه کنید"><small>هنوز دریافت نشده</small><b className={sum.price - sum.paid ? 'warn' : ''}>{toman(sum.price - sum.paid)}</b></div>
      </div>

      {view === 'list' && <ListView list={list} ctx={ctx} />}

      {view === 'board' && days.map((k) => {
        const dayList = list.filter((b) => b.date === k)
        if (!dayList.length && days.length > 2) return null
        return (
          <section key={k} className="bk-day">
            <header>
              <h3>{dayLabel(k)}<small>{dayMonth(fromKey(k))}</small></h3>
              <span>{fa(dayList.length)} رزرو، {toman(dayList.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.price, 0))}</span>
              <button className="adm-btn ghost sm" onClick={() => ctx.open({ kind: 'new', date: k })} data-tip="رزرو دستی برای این روز"><Icon name="plus" size={14} />رزرو</button>
            </header>
            <div className={`bk-lanes ${courts.length === 1 ? 'one' : ''}`} style={{ '--n': courts.length }}>
              {courts.map((c) => {
                const lane = dayList.filter((b) => b.court === c.id).sort((a, b) => a.start - b.start)
                return (
                  <div key={c.id} className="bk-lane">
                    <div className="bk-lane-h"><b>{c.name}</b><small>{c.kind}{club.off[c.id] ? '، غیرفعال' : ''}</small><em>{fa(lane.length)}</em></div>
                    {lane.map((b) => <Ticket key={b.id} b={b} today={k === t} onClick={() => ctx.open({ kind: 'booking', id: b.id })} />)}
                    {!lane.length && <button className="bk-free" onClick={() => ctx.open({ kind: 'new', date: k, court: c.id })} data-tip="رزرو دستی روی این زمین">آزاد<small>+ رزرو</small></button>}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
      {!list.length && (days.length > 2 || view === 'list') && <Empty>با این فیلترها رزروی نیست. {active > 0 && <button className="link" onClick={reset}>پاک کردن فیلترها</button>}</Empty>}
    </div>
  )
}

// کارت هر رزرو: زمین پدل با نسبت واقعی ۲ به ۱، دو بازیکن در هر سمت تور
function Ticket({ b, today, onClick }) {
  const { user } = useStore()
  const st = payState(b)
  const live = today && b.status !== 'cancelled' && nowH() >= b.start && nowH() < b.start + b.dur
  // جای خالی فقط برای بازی باز معنا دارد؛ رزرو خصوصی و کلاس فقط افراد ثبت‌شده را نشان می‌دهند
  const spots = b.type === 'block' ? [] : b.type === 'open' ? Array.from({ length: 4 }, (_, i) => b.players[i] || null) : b.players.slice(0, 4)
  const paidPct = b.price ? Math.min(100, (b.paid / b.price) * 100) : 100
  return (
    <button className={`bk-ticket tp-${b.type} ${b.status === 'cancelled' ? 'cancel' : ''} ${live ? 'is-live' : ''}`} onClick={onClick}
      data-tip={`${TYPE_NAME[b.type]}، ${b.status === 'cancelled' ? 'لغو شده' : STATUS[st].name}${b.type === 'open' ? `، ${fa(b.players.length)} از ۴ بازیکن` : ''}`}>
      <div className="bk-court">
        <i className="net" /><i className="svc a" /><i className="svc b" />
        {b.type === 'block' ? <span className="bk-block"><Icon name="wrench" size={15} />{b.note || 'تعمیرات'}</span>
          : spots.map((p, i) => <i key={i} className={`pl p${i} ${p ? 'on' : ''}`}>{p ? who(p, user)[0] : ''}</i>)}
        {b.type === 'coach' && <i className="pl coach" data-tip="مربی"><Icon name="coach" size={12} /></i>}
      </div>
      <div className="bk-info">
        <div className="bk-top"><span className="bk-time" dir="ltr">{range(b.start, b.dur)}</span>{live && <span className="bk-live"><i />الان</span>}</div>
        {b.type !== 'block' && <>
          <b>{who(b.by, user)}</b>
          <div className="bk-pay"><i style={{ width: `${paidPct}%` }} className={b.status === 'cancelled' ? 'void' : st} /><span>{b.status === 'cancelled' ? 'لغو شده' : st === 'paid' ? toman(b.price) : `${short(b.paid)} از ${short(b.price)}`}</span></div>
        </>}
      </div>
    </button>
  )
}

// نمای لیست: همان فیلترها، یک فهرست ساده بر اساس روز و ساعت
function ListView({ list, ctx }) {
  const { user, adminSettle, toast } = useStore()
  const rows = [...list].sort((a, b) => fromKey(a.date) - fromKey(b.date) || a.start - b.start || a.court - b.court)
  if (!rows.length) return null
  return (
    <Card>
      <div className="tbl-wrap"><table className="tbl bk-list">
        <thead><tr><th>روز و ساعت</th><th>زمین</th><th>نوع</th><th>رزروکننده</th><th data-tip="در بازی باز: چند نفر از ۴ نفر">بازیکن</th><th>مبلغ</th><th>پرداخت</th><th /></tr></thead>
        <tbody>{rows.map((b) => {
          const st = payState(b), due = b.status === 'cancelled' ? 0 : Math.max(0, b.price - b.paid)
          return (
            <tr key={b.id} className={`click ${b.status === 'cancelled' ? 'dim' : ''}`} onClick={() => ctx.open({ kind: 'booking', id: b.id })}>
              <td className="nowrap"><b>{dayLabel(b.date)}</b><small dir="ltr">{range(b.start, b.dur)}</small></td>
              <td>{courtById(b.court).name}</td>
              <td><span className={`type-dot tp-${b.type}`} />{TYPE_NAME[b.type]}</td>
              <td>{b.type === 'block' ? (b.note || '—') : who(b.by, user)}<small>{b.source === 'app' ? 'از اپ' : 'پذیرش'}</small></td>
              <td className="num">{b.type === 'block' ? '—' : b.type === 'open' ? `${fa(b.players.length)} از ۴` : fa(b.players.length)}</td>
              <td className="num">{b.price ? toman(b.price) : '—'}</td>
              <td>{b.type === 'block' ? '—' : <Status s={b.status === 'cancelled' ? 'void' : st} />}{due > 0 && <small>مانده {short(due)}</small>}</td>
              <td onClick={(e) => e.stopPropagation()}>{due > 0 && <button className="adm-btn primary sm" data-tip="مانده با کارتخوان دریافت شد" onClick={() => { adminSettle(b.id, 'card'); toast({ icon: '✅', title: 'تسویه شد', body: toman(due) }) }}>تسویه</button>}</td>
            </tr>
          )
        })}</tbody>
      </table></div>
    </Card>
  )
}
