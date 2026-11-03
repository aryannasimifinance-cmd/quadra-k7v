// آدینه‌ها و تورنمنت‌ها: تعریف مسابقه، ثبت‌نام‌ها، تیم‌بندی، گروه‌ها، مرحله‌ی حذفی، برنده‌ها، ورودی‌ها و فروش کافه‌ی همان روز
import { Fragment, useMemo, useState } from 'react'
import { EVENT_KIND, EV_IMG, LEVELS, MEMBERS, METHOD_NAME, dayLabel, fa, fromKey, hourLabel, short, toman, todayKey } from '../../data'
import {
  EV_FORMAT, EV_STATUS, cafeOf, entryTotal, eventAt, finished, groupsDone, makeGroups, makeKnockout, makeTeams, podium, regPower, setScore, swapPlayers, teamName, upcoming,
} from '../../events'
import { dk, jDate, jDateFa, jMonthKey, jMonthLabel } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'
import { chime } from '../../fx'
import { useStore } from '../../store'
import { Icon, LevelPill } from '../../components/ui'
import { Bracket, Groups, Podium, Teams } from '../../components/Tournament'
import { who } from './derive'
import { Badge, Card, Empty, Field, Guide, Kpi, Money, Pager, Search, Seg, Side, Tabs, XlsxBtn, useSlice } from './kit'

const time = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })
const when = (e) => `${dayLabel(e.date)} ${jDateFa(e.date)}، ${hourLabel(e.start)} تا ${hourLabel(e.start + e.dur)}`
const St = ({ s }) => <Badge tone={EV_STATUS[s][1]}>{EV_STATUS[s][0]}</Badge>
const sum = (l, f) => l.reduce((s, x) => s + f(x), 0)

export function Events() {
  const { club } = useStore()
  const [tab, setTab] = useState('next')
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState(null) // رویداد یا 'new'
  const ev = sel && club.events.find((e) => e.id === sel)
  return (
    <div className="stack">
      {ev ? <Detail ev={ev} onBack={() => setSel(null)} onEdit={() => setForm(ev)} /> : (<>
        <div className="sec-bar">
          <Tabs value={tab} onChange={setTab} tabs={[
            ['next', 'پیش‌رو', upcoming(club).length, 'مسابقه‌هایی که هنوز برگزار نشده‌اند'],
            ['past', 'برگزارشده‌ها', null, 'نتیجه‌ها، برنده‌ها، ورودی‌ها و فروش کافه‌ی هر هفته'],
            ['all', 'همه', null, 'همه‌ی مسابقه‌ها، از جمله پیش‌نویس و لغوشده'],
          ]} />
          <div className="sec-actions">
            <button className="adm-btn primary sm" onClick={() => setForm('new')} data-tip="آدینه یا تورنمنت تازه؛ بعد از انتشار در اپ دیده می‌شود"><Icon name="plus" size={16} />آدینه‌ی جدید</button>
          </div>
        </div>
        <Guide>{{
          next: 'روی هر مسابقه بزنید تا شرکت‌کننده‌ها، تیم‌بندی، گروه‌ها و جدول حذفی را مدیریت کنید. هر چه این‌جا تغییر کند همان لحظه در اپ دیده می‌شود.',
          past: 'برنده‌ها، ورودی‌ها و فروش کافه‌ی هر هفته. سفارش‌های کافه از یک ساعت قبل تا یک ساعت بعد از مسابقه، فروش همان مسابقه حساب می‌شوند.',
          all: 'پیش‌نویس‌ها در اپ دیده نمی‌شوند تا «ثبت‌نام باز» شوند.',
        }[tab]}</Guide>
        <List tab={tab} onOpen={setSel} />
      </>)}
      <Side open={!!form} onClose={() => setForm(null)} title={form === 'new' ? 'آدینه‌ی جدید' : 'ویرایش مسابقه'} wide>
        {form && <EventForm key={form.id || 'new'} ev={form === 'new' ? null : form} onClose={(id) => { setForm(null); if (id) setSel(id) }} />}
      </Side>
    </div>
  )
}

// ---------- فهرست ----------
function List({ tab, onOpen }) {
  const { club } = useStore()
  const [q, setQ] = useState('')
  const base = tab === 'next' ? upcoming(club).concat((club.events || []).filter((e) => e.status === 'draft')) : tab === 'past' ? finished(club) : [...club.events].sort((a, b) => fromKey(b.date) - fromKey(a.date))
  const rows = useMemo(() => base.map((e) => {
    const cafe = cafeOf(club, e)
    return { e, entry: entryTotal(e), cafe: sum(cafe, (o) => o.total), cafeN: cafe.length, champ: podium(e) && teamName(e, podium(e).first) }
  }), [base, club])
  // جستجو با عنوان یا نام شرکت‌کننده: «این آدم کدام آدینه‌ها آمده»
  const w = q.trim()
  const list = rows.filter((r) => !w || r.e.title.includes(w) || r.e.regs.some((x) => x.name?.includes(w) || x.phone?.includes(w)))
  const pg = useSlice(list, 15, tab + w)
  const T = { entry: sum(list, (r) => r.entry), cafe: sum(list, (r) => r.cafe), regs: sum(list, (r) => r.e.regs.length) }
  const next = upcoming(club)[0]
  const exp = () => downloadXlsx(`quadra-events-${jDate(todayKey()).replace(/\//g, '-')}`, [{
    name: 'مسابقه‌ها', rows: table('آدینه‌ها و تورنمنت‌های کوادرا', ['تاریخ', 'ساعت', 'عنوان', 'نوع', 'وضعیت', 'ثبت‌نام', 'ظرفیت', 'ورودی هر نفر', 'جمع ورودی', 'فروش کافه', 'جمع درآمد', 'قهرمان'],
      list.map(({ e, entry, cafe, champ }) => [jDate(e.date), hourLabel(e.start), e.title, EVENT_KIND[e.kind].name, EV_STATUS[e.status][0], e.regs.length, e.cap, e.fee, entry, cafe, entry + cafe, champ || ''])),
  }])
  return (
    <div className="stack">
      <div className="kpis four">
        <Kpi icon="trophy" label="مسابقه‌ی بعدی" value={next ? next.title : '—'} sub={next ? `${dayLabel(next.date)} ${jDateFa(next.date)}، ${fa(next.regs.length)} از ${fa(next.cap)} نفر` : 'برنامه‌ای اعلام نشده'} />
        <Kpi icon="users" label="ثبت‌نام‌ها" value={fa(T.regs)} sub={`${fa(list.length)} مسابقه در این فهرست`} />
        <Kpi icon="cash" label="جمع ورودی‌ها" value={short(T.entry) + ' تومان'} />
        <Kpi icon="cup" label="فروش کافه در مسابقه‌ها" value={short(T.cafe) + ' تومان'} sub="جدا از فروش روزهای عادی" />
      </div>
      <div className="log-bar">
        <Search value={q} onChange={setQ} ph="عنوان مسابقه یا نام شرکت‌کننده" />
        <XlsxBtn onClick={exp} />
      </div>
      <div className="ev-rows">
        {pg.rows.map(({ e, entry, cafe, cafeN, champ }, i) => (
          <Fragment key={e.id}>
          {(i === 0 || jMonthKey(pg.rows[i - 1].e.date) !== jMonthKey(e.date)) && <h4 className="ev-month">{jMonthLabel(jMonthKey(e.date))}</h4>}
          <button className="ev-row" onClick={() => onOpen(e.id)}>
            <div className="ev-date"><b>{fa(+jDate(e.date).split('/')[2])}</b><small>{dayLabel(e.date)}</small><small>{hourLabel(e.start)}</small></div>
            <div className="grow">
              <div className="row-gap"><b>{e.title}</b><St s={e.status} />{e.kind === 'official' && <Badge tone="warn">رسمی</Badge>}</div>
              <small>{jDateFa(e.date)}، {e.desc || EV_FORMAT[e.format]}، سطح {e.levels.join(' / ')}</small>
              <div className="ev-cap-adm"><i style={{ width: `${Math.min(100, (e.regs.length / e.cap) * 100)}%` }} /></div>
              <small>{fa(e.regs.length)} از {fa(e.cap)} نفر{e.teams.length ? `، ${fa(e.teams.length)} تیم` : ''}{champ ? <>، <b className="champ">🏆 {champ}</b></> : ''}</small>
            </div>
            <div className="ev-money">
              <div><small>ورودی</small><b>{toman(entry)}</b></div>
              <div><small>کافه ({fa(cafeN)} سفارش)</small><b>{toman(cafe)}</b></div>
            </div>
          </button>
          </Fragment>
        ))}
        {!list.length && <Empty>{w ? `مسابقه‌ای با «${w}» پیدا نشد.` : 'مسابقه‌ای در این فهرست نیست.'}</Empty>}
      </div>
      <div className="log-foot">{list.length > 0 && <small>{fa(pg.from + 1)} تا {fa(pg.from + pg.rows.length)} از {fa(list.length)}</small>}<Pager {...pg} /></div>
    </div>
  )
}

// ---------- جزئیات یک مسابقه ----------
function Detail({ ev, onBack, onEdit }) {
  const { club, adminEventSave, adminEventDel, toast } = useStore()
  const ko = ev.matches.some((m) => m.stage === 'ko')
  const [tab, setTab] = useState(() => (ko ? 'ko' : ev.groups.length ? 'groups' : ev.teams.length ? 'teams' : 'people'))
  const cafe = cafeOf(club, ev)
  const entry = entryTotal(ev), cafeT = sum(cafe, (o) => o.total)
  const p = podium(ev)
  const setStatus = (status) => { adminEventSave({ id: ev.id, status }); chime('tap'); toast({ icon: '🏆', title: `«${ev.title}»: ${EV_STATUS[status][0]}` }) }
  const del = () => {
    if (ev.regs.some((r) => r.paid > 0)) { setStatus('cancelled'); return }
    if (window.confirm(`«${ev.title}» پاک شود؟`)) { adminEventDel(ev.id); onBack() }
  }
  const left = ev.matches.filter((m) => m.stage === 'group' && (m.sa == null || m.sa === m.sb)).length
  // مراحل برگزاری: هر مرحله زبانه‌ی خودش است؛ مرحله‌ی جاری اولین مرحله‌ی تمام‌نشده است
  const steps = [
    ['people', 'شرکت‌کننده‌ها', `${fa(ev.regs.length)} از ${fa(ev.cap)} نفر`, ev.status !== 'open' && ev.status !== 'draft' && ev.regs.length >= 2],
    ['teams', 'تیم‌بندی', ev.teams.length ? `${fa(ev.teams.length)} تیم` : 'هنوز چیده نشده', ev.teams.length > 0],
    ev.format === 'groups' && ['groups', 'گروه‌ها و نتایج', !ev.groups.length ? 'هنوز ساخته نشده' : left ? `${fa(left)} بازی مانده` : 'همه نتیجه دارند', groupsDone(ev)],
    ['ko', 'مرحله‌ی حذفی', p ? 'فینال انجام شد' : ko ? 'در جریان' : 'هنوز ساخته نشده', !!p],
  ].filter(Boolean)
  const cur = ev.status === 'done' ? null : steps.find((s) => !s[3])
  const next = ev.status === 'done' ? ['برگزار شد؛ نتیجه‌ها و برنده‌ها در اپ دیده می‌شوند.']
    : !cur ? ['همه‌ی مراحل انجام شد.', 'ثبت پایان مسابقه', () => setStatus('done')]
    : cur[0] === 'people' ? [ev.status === 'draft' ? 'پیش‌نویس است و در اپ دیده نمی‌شود.' : 'ثبت‌نام باز است. وقتی ظرفیت پر شد یا زمانش رسید، ثبت‌نام را ببندید.', ev.status === 'draft' ? 'انتشار در اپ' : 'بستن ثبت‌نام و تیم‌بندی', () => { setStatus(ev.status === 'draft' ? 'open' : 'closed'); if (ev.status !== 'draft') setTab('teams') }]
    : cur[0] === 'teams' ? ['تیم‌ها را هم‌سطح بچینید.', 'رفتن به تیم‌بندی', () => setTab('teams')]
    : cur[0] === 'groups' ? [ev.groups.length ? 'نتیجه‌ی بازی‌های گروهی را ثبت کنید.' : 'گروه‌ها را بسازید.', 'رفتن به گروه‌ها', () => setTab(ev.groups.length ? 'groups' : 'teams')]
    : ['نتیجه‌ی بازی‌های حذفی را ثبت کنید تا قهرمان مشخص شود.', 'رفتن به مرحله‌ی حذفی', () => setTab(ko ? 'ko' : 'groups')]
  return (
    <div className="stack">
      <button className="adm-btn ghost sm ev-back" onClick={onBack}><Icon name="fwd" size={16} />همه‌ی مسابقه‌ها</button>
      <div className="ev-hero">
        <div className="ev-thumb" style={{ backgroundImage: `url(${ev.img})` }} />
        <div className="grow">
          <div className="row-gap"><h2>{ev.title}</h2><St s={ev.status} /><Badge tone={ev.kind === 'official' ? 'warn' : 'ok'}>{EVENT_KIND[ev.kind].name}</Badge></div>
          <div className="ev-facts">
            <span><Icon name="cal" size={14} />{when(ev)}</span>
            <span><Icon name="court" size={14} />زمین {ev.courts.map((c) => fa(c)).join('، ')}</span>
            <span><Icon name="users" size={14} />سطح {ev.levels.join(' / ')}، {ev.desc || EV_FORMAT[ev.format]}</span>
            <span><Icon name="cash" size={14} />ورودی {toman(ev.fee)}، جایزه: {ev.prize}</span>
          </div>
        </div>
        <div className="ev-acts">
          <select value={ev.status} onChange={(e) => setStatus(e.target.value)} data-tip="پیش‌نویس در اپ دیده نمی‌شود؛ «بسته» دیده می‌شود ولی ثبت‌نام نمی‌گیرد">{Object.entries(EV_STATUS).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</select>
          <button className="adm-btn ghost sm" onClick={onEdit}><Icon name="cog" size={16} />ویرایش</button>
          <button className="adm-btn ghost sm" onClick={del} data-tip={ev.regs.some((r) => r.paid > 0) ? 'ورودی پرداخت‌شده دارد؛ لغو می‌شود' : 'حذف کامل'}>{ev.regs.some((r) => r.paid > 0) ? 'لغو' : 'حذف'}</button>
        </div>
      </div>
      <div className="kpis four">
        <Kpi icon="users" label="ثبت‌نام" value={`${fa(ev.regs.length)} از ${fa(ev.cap)}`} sub={`${fa(ev.regs.filter((r) => r.source === 'app').length)} از اپ، ${fa(ev.regs.filter((r) => r.source !== 'app').length)} حضوری`} />
        <Kpi icon="cash" label="ورودی‌ها" value={toman(entry)} sub={`${toman(ev.fee)} هر نفر`} />
        <Kpi icon="cup" label="فروش کافه‌ی این مسابقه" value={toman(cafeT)} sub={`${fa(cafe.length)} سفارش`} onClick={() => setTab('cafe')} />
        <Kpi icon="trophy" label={p ? 'قهرمان' : 'جمع درآمد'} value={p ? teamName(ev, p.first) : toman(entry + cafeT)} sub={p ? `نایب‌قهرمان: ${teamName(ev, p.second)}` : 'ورودی + کافه'} />
      </div>
      <Podium ev={ev} />
      <div className="ev-steps">
        {steps.map(([k, n, sub, ok], i) => (
          <button key={k} className={`${tab === k ? 'on' : ''} ${ok ? 'ok' : ''} ${cur?.[0] === k ? 'cur' : ''}`} onClick={() => setTab(k)}>
            <i>{ok ? '✓' : fa(i + 1)}</i><span><b>{n}</b><small>{sub}</small></span>
          </button>
        ))}
        <button className={`cafe ${tab === 'cafe' ? 'on' : ''}`} onClick={() => setTab('cafe')}><i>☕</i><span><b>فروش کافه</b><small>{fa(cafe.length)} سفارش</small></span></button>
      </div>
      <div className={`ev-next ${ev.status === 'done' ? 'done' : ''}`}><span>{next[0]}</span>{next[1] && <button className="adm-btn primary sm" onClick={next[2]}>{next[1]}</button>}</div>
      {tab === 'people' && <People ev={ev} />}
      {tab === 'teams' && <TeamsTab ev={ev} go={setTab} />}
      {tab === 'groups' && <GroupsTab ev={ev} go={setTab} />}
      {tab === 'ko' && <KoTab ev={ev} go={setTab} />}
      {tab === 'cafe' && <CafeTab orders={cafe} />}
    </div>
  )
}

function People({ ev }) {
  const { adminEventReg, adminEventUnreg, toast } = useStore()
  const [mq, setMq] = useState('')
  const [member, setMember] = useState(null)
  const [level, setLevel] = useState('C')
  const [method, setMethod] = useState('cash')
  const [paid, setPaid] = useState(ev.fee)
  const found = mq && !member ? MEMBERS.filter((m) => (m.name.includes(mq) || m.phone.includes(mq)) && !ev.regs.some((r) => r.by === m.id)).slice(0, 5) : []
  const guest = mq.trim()
  const full = ev.regs.length >= ev.cap
  const add = () => {
    const p = member ? { by: member.id, name: member.name, level: member.level, phone: member.phone } : { by: 'f:' + guest, name: guest, level }
    adminEventReg(ev.id, p, method, method === 'free' ? 0 : paid)
    chime('success'); toast({ icon: '🎾', title: `${p.name} ثبت‌نام شد`, body: method === 'free' ? 'بدون ورودی' : `${toman(paid)}، ${METHOD_NAME[method]}` })
    setMember(null); setMq('')
  }
  const remove = (r) => {
    if (!window.confirm(`${r.name} از مسابقه حذف شود؟${r.paid ? ` ورودی ${toman(r.paid)} برگشت داده شده حساب می‌شود.` : ''}${ev.teams.length ? ' تیم‌بندی هم پاک می‌شود.' : ''}`)) return
    adminEventUnreg(ev.id, r.id)
  }
  return (
    <div className="two wide-first">
      <Card title="شرکت‌کننده‌ها" sub={`${fa(ev.regs.length)} از ${fa(ev.cap)} نفر، به ترتیب ثبت‌نام`}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>#</th><th>نام</th><th>سطح</th><th>ثبت‌نام</th><th>ورودی</th><th /></tr></thead>
          <tbody>{ev.regs.map((r, i) => (
            <tr key={r.id}><td>{fa(i + 1)}</td><td><b>{r.name}</b>{r.by?.startsWith('f:') && <small>مهمان</small>}{r.phone && <small dir="ltr">{r.phone}</small>}</td>
              <td>{r.level ? <LevelPill id={r.level} /> : '—'}</td><td><small>{r.source === 'app' ? 'اپ' : 'حضوری'}، {jDateFa(dk(r.at))}</small></td>
              <td className="num">{r.paid ? <>{toman(r.paid)}<small>{METHOD_NAME[r.method] || r.method}</small></> : 'رایگان'}</td>
              <td><button className="icon-btn" onClick={() => remove(r)} aria-label="حذف" data-tip="حذف و برگرداندن ورودی"><Icon name="close" size={15} /></button></td></tr>
          ))}</tbody>
        </table></div>
        {!ev.regs.length && <Empty>هنوز کسی ثبت‌نام نکرده.</Empty>}
      </Card>
      <Card title="ثبت‌نام حضوری" sub={full ? 'ظرفیت تکمیل است' : `${fa(ev.cap - ev.regs.length)} جای خالی`}>
        <div className="form">
          <Field label="بازیکن">
            {member ? <div className="picked"><b>{member.name} <LevelPill id={member.level} /></b><button type="button" className="link" onClick={() => setMember(null)}>تغییر</button></div>
              : <><input placeholder="جستجوی عضو یا نام مهمان" value={mq} onChange={(e) => setMq(e.target.value)} />
                {found.length > 0 && <div className="pick-list">{found.map((m) => <button type="button" key={m.id} onClick={() => setMember(m)}><b>{m.name}</b><small>{m.level}</small><small dir="ltr">{m.phone}</small></button>)}</div>}</>}
          </Field>
          {!member && guest && <Field label="سطح مهمان" tip="برای تیم‌بندی هم‌سطح"><div className="pick-chips sm">{LEVELS.map((l) => <button key={l.id} type="button" className={level === l.id ? 'on' : ''} onClick={() => setLevel(l.id)}>{l.id}</button>)}</div></Field>}
          <Field label="پرداخت"><Seg value={method} onChange={setMethod} options={{ cash: 'نقدی', card: 'کارتخوان', free: 'رایگان' }} /></Field>
          {method !== 'free' && <Field label="مبلغ ورودی"><Money value={paid} onChange={setPaid} /></Field>}
          <button className="adm-btn primary full" disabled={full || (!member && !guest)} onClick={add}>ثبت‌نام</button>
        </div>
      </Card>
    </div>
  )
}

function TeamsTab({ ev, go }) {
  const { adminEventSet, toast } = useStore()
  const [pick, setPick] = useState(null)
  const started = ev.matches.some((m) => m.sa != null)
  const auto = () => {
    if (ev.teams.length && !window.confirm('تیم‌ها، گروه‌ها و نتیجه‌های فعلی پاک و از نو چیده شوند؟')) return
    adminEventSet(ev.id, makeTeams); chime('success'); toast({ icon: '🎾', title: 'تیم‌ها هم‌سطح چیده شدند', body: 'قوی‌ترین بازیکن با ضعیف‌ترین هم‌تیمی شد' })
  }
  const onPick = (p) => {
    if (started) { toast({ icon: '⚠️', title: 'بازی‌ها شروع شده‌اند', body: 'برای جابه‌جایی، تیم‌بندی را از نو بچینید' }); return }
    if (!pick) { setPick(p); return }
    if (pick !== p) { adminEventSet(ev.id, (e) => ({ ...swapPlayers(e, pick, p), groups: [], matches: [] })); chime('tap') }
    setPick(null)
  }
  const build = (size) => {
    if (ev.matches.length && !window.confirm('گروه‌ها و نتیجه‌های فعلی پاک شوند؟')) return
    adminEventSet(ev.id, (e) => (e.format === 'knockout' ? makeKnockout({ ...e, groups: [], matches: [] }) : makeGroups(e, size)))
    chime('success'); go(ev.format === 'knockout' ? 'ko' : 'groups')
  }
  const odd = ev.regs.length % 2 === 1
  return (
    <Card title="تیم‌ها" sub={ev.teams.length ? (pick ? 'حالا بازیکن دوم را بزنید تا جایشان عوض شود' : 'برای جابه‌جایی، روی یک بازیکن و بعد روی بازیکن دیگر بزنید') : 'هنوز تیم‌بندی نشده'}
      right={<div className="row-btns">
        <button className="adm-btn ghost sm" disabled={ev.regs.length < 2} onClick={auto} data-tip="بازیکن‌ها به ترتیب سطح؛ قوی‌ترین با ضعیف‌ترین"><Icon name="refresh" size={15} />تیم‌بندی خودکار هم‌سطح</button>
        {ev.teams.length > 1 && (ev.format === 'knockout'
          ? <button className="adm-btn primary sm" onClick={() => build()}>ساخت جدول حذفی</button>
          : <><button className="adm-btn primary sm" onClick={() => build(4)} data-tip="گروه‌های ۴ تیمی">ساخت گروه‌ها</button><button className="adm-btn ghost sm" onClick={() => build(3)} data-tip="گروه‌های ۳ تیمی؛ بازی کمتر">گروه ۳ تیمی</button></>)}
      </div>}>
      {odd && <p className="pt-warn">تعداد ثبت‌نام فرد است ({fa(ev.regs.length)} نفر)؛ یک نفر بدون یار می‌ماند. یک نفر دیگر ثبت‌نام کنید یا او را حذف کنید.</p>}
      {ev.teams.length ? <Teams ev={ev} onPick={onPick} picked={pick} /> : <Empty>{ev.regs.length < 2 ? 'حداقل دو شرکت‌کننده لازم است.' : '«تیم‌بندی خودکار هم‌سطح» را بزنید.'}</Empty>}
      {ev.teams.length > 0 && <small className="muted-note">قدرت تیم‌ها (جمع امتیاز سطح): {ev.teams.map((t) => fa(t.players.reduce((s, p) => s + regPower(ev.regs.find((r) => r.id === p) || {}), 0))).join('، ')}</small>}
    </Card>
  )
}

function GroupsTab({ ev, go }) {
  const { adminEventSet, toast } = useStore()
  const score = (id, a, b) => adminEventSet(ev.id, (e) => setScore(e, id, a, b))
  const done = groupsDone(ev)
  const left = ev.matches.filter((m) => m.stage === 'group' && (m.sa == null || m.sa === m.sb)).length
  const ko = () => {
    if (ev.matches.some((m) => m.stage === 'ko') && !window.confirm('جدول حذفی فعلی پاک و از نو ساخته شود؟')) return
    if (!done && !window.confirm(`${fa(left)} بازی گروهی هنوز نتیجه ندارد. با جدول فعلی جدول حذفی ساخته شود؟`)) return
    adminEventSet(ev.id, (e) => makeKnockout({ ...e, matches: e.matches.filter((m) => m.stage === 'group') }))
    chime('success'); toast({ icon: '🏆', title: 'جدول حذفی ساخته شد', body: ev.groups.length === 1 ? '۴ تیم اول' : 'اول و دوم هر گروه' }); go('ko')
  }
  if (!ev.groups.length) return <Card><Empty>اول در «تیم‌ها» گروه‌ها را بسازید.</Empty></Card>
  return (
    <Card title="گروه‌ها و نتایج" sub={done ? 'همه‌ی بازی‌های گروهی نتیجه دارند' : `نتیجه را بنویسید (گیم‌های هر تیم)؛ ${fa(left)} بازی مانده`}
      right={<button className={`adm-btn ${done ? 'primary' : 'ghost'} sm`} onClick={ko}>ساخت مرحله‌ی حذفی</button>}>
      <Groups ev={ev} onScore={score} />
    </Card>
  )
}

function KoTab({ ev, go }) {
  const { adminEventSet } = useStore()
  const score = (id, a, b) => adminEventSet(ev.id, (e) => setScore(e, id, a, b))
  const p = podium(ev)
  if (!ev.matches.some((m) => m.stage === 'ko')) return <Card><Empty>{ev.format === 'groups' ? 'بعد از بازی‌های گروهی، در «گروه‌ها و نتایج» مرحله‌ی حذفی را بسازید.' : 'اول در «تیم‌ها» جدول حذفی را بسازید.'}{ev.format === 'groups' && ev.groups.length > 0 && <><br /><button className="adm-btn ghost sm" onClick={() => go('groups')}>رفتن به گروه‌ها</button></>}</Empty></Card>
  return (
    <Card title="مرحله‌ی حذفی" sub="برنده‌ی هر بازی خودکار به دور بعد می‌رود؛ اگر نتیجه‌ای را عوض کنید، دورهای بعد از نو ساخته می‌شوند"
>
      <Bracket ev={ev} onScore={score} />
    </Card>
  )
}

function CafeTab({ orders }) {
  const { user } = useStore()
  const top = {}
  orders.forEach((o) => o.items.forEach((x) => { top[x.name] = (top[x.name] || 0) + x.qty }))
  return (
    <div className="two wide-first">
      <Card title="سفارش‌های کافه در زمان مسابقه" sub="از یک ساعت قبل تا یک ساعت بعد؛ جدا از فروش روزهای عادی">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>سفارش</th><th>مشتری</th><th>اقلام</th><th>مبلغ</th></tr></thead>
          <tbody>{orders.map((o) => <tr key={o.id}><td><b dir="ltr">{o.id}</b><small>{time.format(o.at)}</small></td><td>{who(o.by, user)}</td><td><small>{o.items.map((x) => `${fa(x.qty)}× ${x.name}`).join('، ')}</small></td><td className="num">{toman(o.total)}</td></tr>)}</tbody>
        </table></div>
        {!orders.length && <Empty>سفارشی در زمان این مسابقه ثبت نشده.</Empty>}
      </Card>
      <Card title="پرفروش‌های این مسابقه">
        {Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => <div key={n} className="row-between ev-top"><span>{n}</span><b>{fa(c)}</b></div>)}
        {!orders.length && <Empty>—</Empty>}
      </Card>
    </div>
  )
}

// ---------- فرم تعریف مسابقه ----------
const toInput = (k) => { const [y, m, d] = k.split('-'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` }
const fromInput = (v) => { const [y, m, d] = v.split('-').map(Number); return `${y}-${m}-${d}` }
function nextFriday() { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }

function EventForm({ ev, onClose }) {
  const { club, adminEventSave, toast } = useStore()
  const [f, setF] = useState(() => ev || { kind: 'friday', title: 'آدینه‌ی کوادرا', desc: 'هر بازی با یار جدید', format: 'groups', date: nextFriday(), start: 9, dur: 3, courts: [1, 2, 3, 4], levels: ['B', 'C+', 'C'], cap: 16, fee: 750000, prize: 'راکت + توپ', img: EV_IMG[0], status: 'open', note: '' })
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const tog = (k, v) => set({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] })
  const clash = eventAt(club.events.filter((e) => e.id !== ev?.id), fromKey(f.date).getTime() + f.start * 36e5)
  const ok = f.title.trim() && f.date && f.cap > 1 && f.courts.length && f.levels.length
  const save = () => {
    const s = adminEventSave({ ...f, title: f.title.trim(), id: ev?.id })
    chime('success'); toast({ icon: '🏆', title: ev ? 'مسابقه به‌روز شد' : 'مسابقه ساخته شد', body: f.status === 'draft' ? 'پیش‌نویس؛ هنوز در اپ دیده نمی‌شود' : 'در اپ دیده می‌شود' })
    onClose(s.id)
  }
  return (
    <div className="form">
      <Field label="نوع"><Seg value={f.kind} onChange={(kind) => set({ kind, ...(ev ? {} : kind === 'official' ? { title: 'تورنمنت کوادرا', desc: 'گروهی + حذفی، امتیاز رنکینگ', start: 10, dur: 8, cap: 32, fee: 1500000, prize: 'جایزه‌ی نقدی + جام', levels: ['A', 'B+', 'B', 'C+'] } : { title: 'آدینه‌ی کوادرا', desc: 'هر بازی با یار جدید', start: 9, dur: 3, cap: 16, fee: 750000 }) })} options={{ friday: 'مسابقه‌ی آدینه', official: 'تورنمنت رسمی' }} /></Field>
      <Field label="اسم مسابقه"><input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثلاً آدینه‌ی بانوان" /></Field>
      <Field label="توضیح کوتاه" hint="زیر اسم در اپ نشان داده می‌شود"><input value={f.desc} onChange={(e) => set({ desc: e.target.value })} /></Field>
      <div className="form-3">
        <Field label="تاریخ" hint={`${dayLabel(f.date)} ${jDateFa(f.date)}`}><input type="date" value={toInput(f.date)} onChange={(e) => e.target.value && set({ date: fromInput(e.target.value) })} /></Field>
        <Field label="ساعت شروع"><select value={f.start} onChange={(e) => set({ start: +e.target.value })}>{Array.from({ length: 16 }, (_, i) => i + 7).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></Field>
        <Field label="مدت (ساعت)"><select value={f.dur} onChange={(e) => set({ dur: +e.target.value })}>{[1, 2, 3, 4, 5, 6, 8, 10].map((h) => <option key={h} value={h}>{fa(h)} ساعت</option>)}</select></Field>
      </div>
      {clash && <p className="pt-warn">هم‌زمان با «{clash.title}» است؛ فروش کافه‌ی این ساعت‌ها به اولی نسبت داده می‌شود.</p>}
      <Field label="زمین‌ها"><div className="pick-chips">{[1, 2, 3, 4].map((c) => <button key={c} type="button" className={f.courts.includes(c) ? 'on' : ''} onClick={() => tog('courts', c)}>زمین {fa(c)}</button>)}</div></Field>
      <Field label="سطح‌های مجاز"><div className="pick-chips sm">{LEVELS.map((l) => <button key={l.id} type="button" className={f.levels.includes(l.id) ? 'on' : ''} onClick={() => tog('levels', l.id)}>{l.id}</button>)}</div></Field>
      <Field label="روش برگزاری"><Seg value={f.format} onChange={(format) => set({ format })} options={EV_FORMAT} tips={{ groups: 'اول دوره‌ای در گروه‌ها، بعد حذفی', knockout: 'از اول حذفی' }} /></Field>
      <div className="form-3">
        <Field label="ظرفیت (نفر)"><input type="number" min="2" value={f.cap} onChange={(e) => set({ cap: +e.target.value })} /></Field>
        <Field label="ورودی هر نفر"><Money value={f.fee} onChange={(fee) => set({ fee })} /></Field>
        <Field label="جایزه"><input value={f.prize} onChange={(e) => set({ prize: e.target.value })} /></Field>
      </div>
      <Field label="عکس"><div className="ev-imgs">{EV_IMG.map((s) => <button key={s} type="button" className={f.img === s ? 'on' : ''} style={{ backgroundImage: `url(${s})` }} onClick={() => set({ img: s })} aria-label="عکس" />)}</div></Field>
      <Field label="یادداشت برای بازیکن‌ها" hint="اختیاری؛ مثلاً «۱۵ دقیقه زودتر بیایید»"><input value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
      <Field label="وضعیت"><Seg value={f.status} onChange={(status) => set({ status })} options={{ draft: 'پیش‌نویس', open: 'ثبت‌نام باز', closed: 'ثبت‌نام بسته' }} /></Field>
      <button className="adm-btn primary full" disabled={!ok} onClick={save}>{ev ? 'ذخیره' : 'ساخت مسابقه'}</button>
    </div>
  )
}
