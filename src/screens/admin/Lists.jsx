import { useMemo, useState } from 'react'
import {
  COACH_PACKS, COURTS, LEVELS, MEMBERS, METHOD_NAME, PACKAGES, TYPE_NAME, coachPackPrice, courtById, dayLabel, dayMonth, fa, fromKey,
  levelById, priceFor, range, short, toman, todayKey,
} from '../../data'
import { chime } from '../../fx'
import { payState, useStore } from '../../store'
import { Icon, LevelPill } from '../../components/ui'
import { Card, Empty, Field, Guide, Kpi, More, Search, Seg, Side, Status, XlsxBtn, usePage } from './kit'
import { HBars } from './Charts'
import { SEGMENTS, coachStats, memberStats, payments, who } from './derive'
import { jDate } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'

const fmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// ---------- دریافت‌ها: دو کار ساده — گرفتن مانده‌ها، و دیدن پول‌های رسیده ----------
const KINDS = [['court', 'زمین'], ['coach', 'کلاس'], ['pack', 'پکیج و تورنمنت'], ['shop', 'فروشگاه'], ['cafe', 'کافه']]
const WHEN = { today: 'امروز', week: '۷ روز', month: '۳۰ روز' }
const isToday = (t) => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() }

export function Payments({ ctx }) {
  const { club, user, adminSettle, toast } = useStore()
  const pays = useMemo(() => payments(club, user), [club])
  const [tab, setTab] = useState('due')
  const [when, setWhen] = useState('week')
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')
  const now = Date.now()
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999)
  const dueNow = pays.filter((p) => p.due > 0 && p.at <= endToday.getTime()).sort((a, b) => b.at - a.at)
  const dueLater = pays.filter((p) => p.due > 0 && p.at > endToday.getTime()).sort((a, b) => a.at - b.at)
  const gotToday = pays.filter((p) => p.at <= now && isToday(p.at)).reduce((s, p) => s + p.paid, 0)
  const since = now - { today: 0, week: 7, month: 30 }[when] * 864e5
  const hist = pays.filter((p) => p.paid > 0 && p.at <= now && (when === 'today' ? isToday(p.at) : p.at >= since) && (kind === 'all' || p.kind === kind) && (!q || (p.who + p.title + p.sub).includes(q)))
  const [rows, more] = usePage(hist, 30)
  const settle = (p, m) => { adminSettle(p.id, m); chime('success'); toast({ icon: '✅', title: `${toman(p.due)} دریافت شد`, body: `${p.who}، ${METHOD_NAME[m]}` }) }
  const exp = () => downloadXlsx('quadra-payments', [{ name: 'دریافت‌ها', rows: table(`دریافت‌های باشگاه کوادرا — ${WHEN[when]}`, ['تاریخ', 'ساعت', 'شرح', 'جزئیات', 'مشتری', 'روش', 'مبلغ'],
    hist.map((p) => { const d = new Date(p.at); return [jDate(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`), d.toTimeString().slice(0, 5), p.title, p.sub, p.who, METHOD_NAME[p.method] || '', p.paid] }), ['جمع', '', '', '', '', '', hist.reduce((s, p) => s + p.paid, 0)]) }])
  const Due = ({ p }) => (
    <div className="pay-due">
      <div className="grow" onClick={() => p.ref && ctx.open({ kind: 'booking', id: p.id })}>
        <b>{p.who}</b><small>{p.title}، {p.sub}</small>
      </div>
      <b className="num">{toman(p.due)}</b>
      <div className="row-btns">
        <button className="adm-btn primary sm" onClick={() => settle(p, 'card')} data-tip="مشتری با کارتخوان پرداخت کرد">کارتخوان</button>
        <button className="adm-btn ghost sm" onClick={() => settle(p, 'cash')} data-tip="پول نقد به صندوق آمد">نقدی</button>
      </div>
    </div>
  )
  return (
    <div className="stack">
      <div className="kpis three">
        <Kpi icon="cash" label="امروز دریافت شد" value={toman(gotToday)} tip="جمع پول‌های امروز: رزرو، کلاس، پکیج، فروشگاه و کافه" />
        <Kpi icon="clock" label="باید همین حالا گرفته شود" tone={dueNow.length ? 'warn' : ''} value={toman(dueNow.reduce((s, p) => s + p.due, 0))} sub={`${fa(dueNow.length)} رزرو امروز یا گذشته`} onClick={() => setTab('due')} tip="بازی انجام شده یا امروز است و هنوز کامل پرداخت نشده" />
        <Kpi icon="cal" label="در پذیرش گرفته می‌شود" value={toman(dueLater.reduce((s, p) => s + p.due, 0))} sub={`${fa(dueLater.length)} رزرو آینده`} tip="رزروهای آینده‌ای که موقع بازی پرداخت می‌شوند" />
      </div>
      <Seg value={tab} onChange={setTab} options={{ due: `باید دریافت شود (${fa(dueNow.length + dueLater.length)})`, got: 'دریافت‌شده‌ها' }} tips={{ due: 'مانده‌ها را با یک کلیک تسویه کنید', got: 'تاریخچه‌ی پول‌های رسیده' }} />
      {tab === 'due' ? (
        <div className="two">
          <Card title="امروز و گذشته" sub="اول این‌ها را بگیرید">
            <div className="pay-list">{dueNow.map((p) => <Due key={p.id} p={p} />)}{!dueNow.length && <div className="all-good"><Icon name="check" size={20} /><b>چیزی برای گرفتن نمانده</b></div>}</div>
          </Card>
          <Card title="رزروهای آینده" sub="روز بازی در پذیرش گرفته می‌شود">
            <div className="pay-list">{dueLater.slice(0, 30).map((p) => <Due key={p.id} p={p} />)}{!dueLater.length && <Empty>رزرو پرداخت‌نشده‌ای در آینده نیست.</Empty>}</div>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="bk-row">
            <Seg value={when} onChange={setWhen} options={WHEN} />
            <select value={kind} onChange={(e) => setKind(e.target.value)} data-tip="از کدام بخش"><option value="all">همه‌ی بخش‌ها</option>{KINDS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
            <Search value={q} onChange={setQ} ph="مشتری یا شرح" />
            <XlsxBtn onClick={exp} />
          </div>
          <p className="count">{fa(hist.length)} دریافت، جمع <b>{toman(hist.reduce((s, p) => s + p.paid, 0))}</b></p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>زمان</th><th>شرح</th><th>مشتری</th><th>روش</th><th>مبلغ</th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id} className={p.ref ? 'click' : ''} onClick={() => p.ref && ctx.open({ kind: 'booking', id: p.id })}>
                <td className="nowrap">{fmt.format(p.at)}</td><td><b>{p.title}</b><small>{p.sub}</small></td><td>{p.who}</td>
                <td>{METHOD_NAME[p.method] || '—'}</td><td className="num">{toman(p.paid)}</td>
              </tr>))}</tbody>
          </table></div>
          {!hist.length && <Empty>در این بازه دریافتی نیست.</Empty>}
          <More more={more} />
        </Card>
      )}
    </div>
  )
}

// ---------- اعضا ----------
const SRC = { all: 'همه', app: 'از اپ', desk: 'پذیرش' }
export function Members() {
  const { club, user } = useStore()
  const all = useMemo(() => memberStats(club, user), [club])
  const [seg, setSeg] = useState('all')
  const [src, setSrc] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('spent')
  const [sel, setSel] = useState(null)
  const [add, setAdd] = useState(false)
  const list = all.filter((m) => (seg === 'all' || m.seg === seg) && (src === 'all' || (src === 'desk' ? m.source !== 'app' : m.source === 'app')) && (!q || m.name.includes(q) || m.phone?.includes(q)))
    .sort((a, b) => sort === 'last' ? a.lastDays - b.lastDays : sort === 'new' ? (b.at || 0) - (a.at || 0) : b[sort] - a[sort])
  const counts = Object.fromEntries(Object.keys(SEGMENTS).map((k) => [k, k === 'all' ? all.length : all.filter((m) => m.seg === k).length]))
  const m = sel && all.find((x) => x.id === sel)
  const exp = () => downloadXlsx('quadra-members', [{ name: 'اعضا', rows: table('اعضای باشگاه کوادرا', ['نام', 'موبایل', 'سطح', 'عضویت از', 'بخش', 'تعداد حضور', 'آخرین حضور (روز پیش)', 'رنکینگ', 'مجموع خرید'],
    list.map((x) => [x.name, x.phone, x.level, x.source === 'app' ? 'اپ' : 'پذیرش', SEGMENTS[x.seg], x.visits, x.lastDays >= 99 ? '' : x.lastDays, x.points || '', x.spent]), ['جمع', '', '', '', '', list.reduce((s, x) => s + x.visits, 0), '', '', list.reduce((s, x) => s + x.spent, 0)]) }])
  return (
    <div className="stack">
      <div className="sec-bar">
        <div className="segs-big">
          {Object.entries(SEGMENTS).map(([k, v]) => (
            <button key={k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)} data-tip={SEG_TIP[k]}><b>{fa(counts[k])}</b><small>{v}</small></button>
          ))}
        </div>
        <div className="sec-actions"><button className="adm-btn primary sm" onClick={() => setAdd(true)} data-tip="ثبت عضوی که حضوری یا تلفنی آمده"><Icon name="plus" size={16} />عضو جدید</button></div>
      </div>
      <Guide>کسی که در اپ ثبت‌نام کند خودکار اینجا اضافه می‌شود. عضوی که در پذیرش ثبت کنید هم در «رزرو دستی» قابل انتخاب است.</Guide>
      <Card>
        <div className="bk-row">
          <Search value={q} onChange={setQ} ph="نام یا موبایل" />
          <Seg value={src} onChange={setSrc} options={SRC} tips={{ app: 'کسانی که خودشان در اپ ثبت‌نام کرده‌اند', desk: 'اعضای ثبت‌شده در پذیرش' }} />
          <select value={sort} onChange={(e) => setSort(e.target.value)} data-tip="ترتیب فهرست"><option value="spent">بیشترین خرید</option><option value="visits">بیشترین حضور</option><option value="last">آخرین حضور</option><option value="new">تازه‌ترین عضو</option><option value="points">رنکینگ</option></select>
          <XlsxBtn onClick={exp} />
        </div>
        <p className="count">{fa(list.length)} عضو</p>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>عضو</th><th>موبایل</th><th>سطح</th><th data-tip="چند بار رزرو یا بازی داشته">حضور</th><th>آخرین حضور</th><th data-tip="جمع پول رزرو، فروشگاه، کافه و پکیج">مجموع خرید</th><th>وضعیت</th></tr></thead>
          <tbody>{list.map((x) => (
            <tr key={x.id} className={`click ${sel === x.id ? 'sel' : ''}`} onClick={() => setSel(sel === x.id ? null : x.id)}>
              <td><div className="prod-cell"><span className="adm-av sm">{x.name[0]}</span><div><b>{x.name}</b><small>{x.source === 'app' ? 'از اپ' : x.source === 'desk' ? 'ثبت در پذیرش' : 'عضو باشگاه'}</small></div>{x.member && <span className="vip">{x.member === 'black' ? 'BLACK' : 'GOLD'}</span>}</div></td>
              <td dir="ltr" className="num">{x.phone}</td><td><LevelPill id={x.level} /></td><td className="num">{fa(x.visits)}</td>
              <td>{x.lastDays === 0 ? 'امروز' : x.lastDays >= 99 ? '—' : `${fa(x.lastDays)} روز پیش`}</td>
              <td className="num">{toman(x.spent)}</td><td><span className={`seg-pill s-${x.seg}`}>{SEGMENTS[x.seg]}</span></td>
            </tr>))}</tbody>
        </table></div>
        {!list.length && <Empty>عضوی پیدا نشد.</Empty>}
      </Card>
      {m && (
        <Card title={m.name} sub={`${levelById(m.level).title}، ${fa(m.visits)} حضور`} right={<button className="adm-btn ghost sm" onClick={() => setSel(null)}>بستن</button>}>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>تاریخ</th><th>ساعت</th><th>زمین</th><th>نوع</th><th>مبلغ</th><th>پرداخت</th></tr></thead>
            <tbody>{club.bookings.filter((b) => b.by === m.id || b.players?.includes(m.id)).sort((a, b) => fromKey(b.date) - fromKey(a.date)).slice(0, 12).map((b) => (
              <tr key={b.id}><td>{dayLabel(b.date)} {dayMonth(fromKey(b.date))}</td><td className="num" dir="ltr">{range(b.start, b.dur)}</td><td>{courtById(b.court).name}</td><td>{TYPE_NAME[b.type]}</td><td className="num">{toman(b.price)}</td><td><Status s={payState(b)} /></td></tr>
            ))}</tbody></table></div>
          {!club.bookings.some((b) => b.by === m.id || b.players?.includes(m.id)) && <Empty>هنوز رزروی ندارد.</Empty>}
        </Card>
      )}
      <Side open={add} onClose={() => setAdd(false)} title="عضو جدید">{add && <MemberForm onClose={() => setAdd(false)} />}</Side>
    </div>
  )
}
const SEG_TIP = { all: 'همه‌ی اعضا', vip: 'عضویت طلایی یا مشکی دارند', active: 'در ۱۰ روز اخیر آمده‌اند', new: 'تازه عضو شده‌اند', risk: 'بیش از ۱۰ روز است نیامده‌اند' }

function MemberForm({ onClose }) {
  const { adminMember, toast } = useStore()
  const [f, setF] = useState({ name: '', phone: '09', level: 'C', side: 'both' })
  const set = (x) => setF((o) => ({ ...o, ...x }))
  const phone = f.phone.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '')
  const dup = MEMBERS.some((m) => m.phone === phone)
  const ok = f.name.trim().length > 2 && /^09\d{9}$/.test(phone) && !dup
  const save = () => { adminMember({ name: f.name.trim(), phone, level: f.level, side: f.side }); chime('success'); toast({ icon: '👤', title: 'عضو اضافه شد', body: f.name.trim() }); onClose() }
  return (
    <div className="form">
      <Field label="نام و نام خانوادگی"><input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثلاً سارا محمدی" /></Field>
      <Field label="موبایل" hint={dup ? 'این شماره قبلاً عضو شده است' : 'با همین شماره می‌تواند در اپ وارد شود'}><input dir="ltr" inputMode="numeric" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
      <Field label="سطح بازی" tip="اگر نمی‌دانید C بگذارید؛ بعداً با بازی‌ها دقیق می‌شود"><select value={f.level} onChange={(e) => set({ level: e.target.value })}>{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.id}، {l.title}</option>)}</select></Field>
      <Field label="سمت بازی"><Seg value={f.side} onChange={(side) => set({ side })} options={{ right: 'راست', left: 'چپ', both: 'هر دو' }} /></Field>
      <button className="adm-btn primary full" disabled={!ok} onClick={save}>ثبت عضو</button>
    </div>
  )
}

export function Coaches() {
  const { club, user } = useStore()
  const stats = coachStats(club).sort((a, b) => b.rating - a.rating)
  const sales = club.sales.slice(0, 30)
  const pk = PACKAGES.map((p) => ({ name: p.name, value: club.sales.filter((s) => s.item === p.id).reduce((a, s) => a + s.price, 0), color: '#E07B39' }))
  return (
    <div className="stack">
      <div className="coach-grid">
        {stats.map((c) => (
          <div key={c.id} className="coach-adm">
            <div className="ca-photo" style={{ backgroundImage: `url(${c.img})` }} />
            <div className="ca-body">
              <div className="row-between"><b>{c.name}</b><LevelPill id={c.level} /></div>
              <small>{c.title}، ★ {fa(c.rating)} از {fa(c.reviews)} نظر ناشناس، {toman(c.price)}/جلسه</small>
              <div className="ca-stats">
                <div><b>{fa(c.sessions)}</b><small>جلسه‌ی برگزارشده</small></div>
                <div><b>{fa(c.upcoming)}</b><small>جلسه‌ی آینده</small></div>
                <div><b>{fa(c.packs)}</b><small>پکیج فروخته</small></div>
                <div><b>{short(c.revenue)}</b><small>درآمد</small></div>
              </div>
              {c.comments.map((r) => <p key={r.id} className="ca-quote">{'★'.repeat(r.stars)} «{r.text}»</p>)}
            </div>
          </div>
        ))}
      </div>
      <div className="two">
        <Card title="فروش پکیج‌های باشگاه"><HBars rows={pk} /></Card>
        <Card title="نرخ پکیج‌های مربی" sub="محاسبه‌ی خودکار از نرخ جلسه">
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>مربی</th>{COACH_PACKS.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead>
            <tbody>{stats.map((c) => <tr key={c.id}><td>{c.name}</td>{COACH_PACKS.map((p) => <td key={p.id} className="num">{short(coachPackPrice(c, p))}</td>)}</tr>)}</tbody></table></div>
        </Card>
      </div>
      <Card title="آخرین فروش‌ها">
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>زمان</th><th>شرح</th><th>نوع</th><th>مشتری</th><th>روش</th><th>مبلغ</th></tr></thead>
          <tbody>{sales.map((s) => <tr key={s.id}><td className="nowrap">{fmt.format(s.at)}</td><td>{s.name}</td><td>{{ coach: 'مربی', package: 'پکیج', event: 'تورنمنت' }[s.kind]}</td><td>{who(s.by, user)}</td><td>{METHOD_NAME[s.method]}</td><td className="num">{toman(s.price)}</td></tr>)}</tbody></table></div>
      </Card>
    </div>
  )
}

export function Settings() {
  const { club, adminPricing, adminCourt, resetDemo, toast } = useStore()
  const [p, setP] = useState(club.pricing)
  const ex = (h) => priceFor(todayKey(), h, 1, p)
  const save = () => { adminPricing({ offpeak: +p.offpeak, peak: +p.peak, peakFrom: +p.peakFrom }); chime('success'); toast({ icon: '💾', title: 'نرخ‌ها ذخیره شد', body: 'در اپ بازیکن‌ها هم اعمال شد' }) }
  return (
    <div className="two">
      <Card title="نرخ زمین" sub="هر ساعت، کل زمین (۴ نفر)">
        <div className="form">
          <label>نرخ عادی (تومان)<input type="number" step="50000" value={p.offpeak} onChange={(e) => setP({ ...p, offpeak: e.target.value })} /></label>
          <label>نرخ پیک (تومان)<input type="number" step="50000" value={p.peak} onChange={(e) => setP({ ...p, peak: e.target.value })} /></label>
          <label>شروع ساعت پیک<select value={p.peakFrom} onChange={(e) => setP({ ...p, peakFrom: e.target.value })}>{[15, 16, 17, 18, 19].map((h) => <option key={h} value={h}>{fa(h)}:۰۰</option>)}</select></label>
          <p className="muted small">پنجشنبه و جمعه تمام روز پیک حساب می‌شود.</p>
          <div className="preview">
            <div><small>۱ ساعت، ساعت ۱۰ (امروز)</small><b>{toman(ex(10))}</b><small>هر نفر {toman(ex(10) / 4)}</small></div>
            <div><small>۱ ساعت، ساعت ۲۰ (امروز)</small><b>{toman(ex(20))}</b><small>هر نفر {toman(ex(20) / 4)}</small></div>
          </div>
          <button className="adm-btn primary" onClick={save} data-tip="قیمت تازه فقط برای رزروهای بعدی اعمال می‌شود">ذخیره‌ی نرخ‌ها</button>
        </div>
      </Card>
      <div className="stack">
        <Card title="وضعیت زمین‌ها" sub="زمین غیرفعال در اپ قابل رزرو نیست">
          <div className="courts-set">
            {COURTS.map((c) => (
              <div key={c.id} className="court-set">
                <div className="cs-photo" style={{ backgroundImage: `url(${c.img})` }} />
                <div className="grow"><b>{c.name}</b><small>{c.kind}، {c.indoor ? 'سرپوشیده' : 'روباز'}</small></div>
                <button className={`tgl-adm ${club.off[c.id] ? '' : 'on'}`} onClick={() => { adminCourt(c.id, !club.off[c.id]); chime('tap') }}><i /><span>{club.off[c.id] ? 'تعمیرات' : 'فعال'}</span></button>
              </div>
            ))}
          </div>
        </Card>
        <Card title="داده‌های نمایشی">
          <p className="muted small">همه‌ی داده‌ها در مرورگر ذخیره می‌شوند و بین اپ بازیکن و پنل مدیر (حتی در دو تب) مشترک‌اند.</p>
          <button className="adm-btn danger" onClick={() => confirm('همه‌ی داده‌ها به حالت اولیه برگردد؟') && resetDemo()}><Icon name="refresh" size={16} />بازنشانی داده‌ها</button>
        </Card>
      </div>
    </div>
  )
}
