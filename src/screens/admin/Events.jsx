// آدینه‌ها و تورنمنت‌ها: تعریف مسابقه، ثبت‌نام‌های دونفره، تیم‌بندی، طراحی گروه‌ها، مرحله‌ی حذفی، برنده‌ها، ورودی‌ها و فروش کافه‌ی روز مسابقه
import { Fragment, useEffect, useMemo, useState } from 'react'
import { EVENT_KIND, EV_IMG, LEVELS, MEMBERS, METHOD_NAME, dayLabel, fa, fromKey, hourLabel, short, toman, todayKey } from '../../data'
import {
  EV_FORMAT, EV_STATUS, ROUND, cafeOf, clashes, entryTotal, eventAt, fillTeams, finished, groupsDone, isLive, loosePairs, withPairs, koRounds, makeGroups, makeKnockout, makeTeams, moveTeam, pairUp, plan, podium, regPower, setScore, showsResults, singles, standings, teamName, unpair, upcoming,
} from '../../events'
import { dk, jDate, jDateFa, jMonthKey, jMonthLabel } from '../../jalali'
import { downloadXlsx, table } from '../../xlsx'
import { chime } from '../../fx'
import { useStore } from '../../store'
import { Icon, LevelPill } from '../../components/ui'
import { Bracket, Groups } from '../../components/Tournament'
import { who } from './derive'
import { Badge, Card, Empty, Field, Guide, ImageUpload, Kpi, Money, Pager, Search, Seg, Side, Tabs, XlsxBtn, useSlice } from './kit'

const time = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })
const when = (e) => `${dayLabel(e.date)} ${jDateFa(e.date)}، ${hourLabel(e.start)} تا ${hourLabel(e.start + e.dur)}`
const St = ({ s }) => <Badge tone={EV_STATUS[s][1]}>{EV_STATUS[s][0]}</Badge>
const sum = (l, f) => l.reduce((s, x) => s + f(x), 0)
const courtsText = (cs) => (cs.length === 4 ? 'همه‌ی زمین‌ها' : `زمین ${cs.map((c) => fa(c)).join('، ')}`)
// وضعیت به زبان ساده: هر گزینه یعنی بازیکن‌ها در اپ چه می‌بینند
const STATUS_HELP = {
  draft: ['پیش‌نویس', 'فقط شما می‌بینید؛ در اپ نشان داده نمی‌شود و زمین‌ها هنوز رزرو نمی‌شوند.'],
  open: ['منتشر، ثبت‌نام باز', 'در اپ دیده می‌شود و بازیکن‌ها می‌توانند تیم دونفره ثبت‌نام کنند.'],
  closed: ['منتشر، ثبت‌نام بسته', 'در اپ دیده می‌شود ولی ثبت‌نام تازه نمی‌گیرد؛ وقت تیم‌بندی است.'],
  done: ['برگزار شد', 'به «برگزارشده‌ها» می‌رود؛ برنده‌ها و جدول‌ها در اپ دیده می‌شوند.'],
  cancelled: ['لغو شد', 'در اپ دیده نمی‌شود و زمین‌ها آزاد می‌شوند.'],
}

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
            <button className="adm-btn primary sm" onClick={() => setForm('new')} data-tip="آدینه یا تورنمنت تازه؛ بعد از انتشار در اپ دیده می‌شود و زمین‌هایش در تقویم رزرو می‌شود"><Icon name="plus" size={16} />آدینه‌ی جدید</button>
          </div>
        </div>
        <Guide>{{
          next: 'روی هر مسابقه بزنید تا ثبت‌نام‌ها، تیم‌ها، گروه‌ها و جدول حذفی را مدیریت کنید. ثبت‌نام در اپ دونفره است و یک نفر ورودی هر دو را می‌دهد.',
          past: 'برنده‌ها، ورودی‌ها و فروش کافه‌ی هر هفته. هر خرید کافه در روز مسابقه، فروش همان روز مسابقه حساب می‌شود.',
          all: 'پیش‌نویس‌ها در اپ دیده نمی‌شوند تا منتشر شوند.',
        }[tab]}</Guide>
        <List tab={tab} onOpen={setSel} />
      </>)}
      <Side open={!!form} onClose={() => setForm(null)} title={form === 'new' ? 'آدینه‌ی جدید' : 'ویرایش مسابقه'} wide>
        {form && <EventForm key={form.id || 'new'} ev={form === 'new' ? null : club.events.find((e) => e.id === form.id)} onClose={(id) => { setForm(null); if (id) setSel(id) }} />}
      </Side>
    </div>
  )
}

// ---------- فهرست: کارت‌های جمع‌وجور، ماه‌به‌ماه ----------
function List({ tab, onOpen }) {
  const { club } = useStore()
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const base = tab === 'next' ? upcoming(club).concat(club.events.filter((e) => e.status === 'draft')) : tab === 'past' ? finished(club) : [...club.events].sort((a, b) => fromKey(b.date) - fromKey(a.date))
    return base.map((e) => {
      const cafe = cafeOf(club, e)
      return { e, entry: entryTotal(e), cafe: sum(cafe, (o) => o.total), champ: podium(e) && teamName(e, podium(e).first) }
    })
  }, [tab, club])
  // جستجو با عنوان یا نام شرکت‌کننده: «این آدم کدام آدینه‌ها آمده»
  const w = q.trim()
  const list = rows.filter((r) => !w || r.e.title.includes(w) || r.e.regs.some((x) => x.name?.includes(w) || x.phone?.includes(w)))
  const pg = useSlice(list, 12, tab + w)
  const T = { entry: sum(list, (r) => r.entry), cafe: sum(list, (r) => r.cafe), regs: sum(list, (r) => r.e.regs.length) }
  const next = upcoming(club)[0]
  const exp = () => downloadXlsx(`quadra-events-${jDate(todayKey()).replace(/\//g, '-')}`, [{
    name: 'مسابقه‌ها', rows: table('آدینه‌ها و تورنمنت‌های کوادرا', ['تاریخ', 'ساعت', 'عنوان', 'نوع', 'وضعیت', 'ثبت‌نام', 'ظرفیت', 'ورودی هر نفر', 'جمع ورودی', 'فروش کافه', 'جمع درآمد', 'قهرمان'],
      list.map(({ e, entry, cafe, champ }) => [jDate(e.date), hourLabel(e.start), e.title, EVENT_KIND[e.kind].name, EV_STATUS[e.status][0], e.regs.length, e.cap, e.fee, entry, cafe, entry + cafe, champ || ''])),
  }])
  // کارت‌ها ماه‌به‌ماه گروه می‌شوند
  const months = []
  pg.rows.forEach((r) => { const k = jMonthKey(r.e.date); const g = months[months.length - 1]; if (g?.k === k) g.rows.push(r); else months.push({ k, rows: [r] }) })
  return (
    <div className="stack">
      <div className="kpis four">
        <Kpi icon="trophy" label="مسابقه‌ی بعدی" value={next ? next.title : '—'} sub={next ? `${dayLabel(next.date)} ${jDateFa(next.date)}، ${fa(next.regs.length)} از ${fa(next.cap)} نفر` : 'برنامه‌ای اعلام نشده'} />
        <Kpi icon="users" label="ثبت‌نام‌ها" value={fa(T.regs)} sub={`${fa(list.length)} مسابقه در این فهرست`} />
        <Kpi icon="cash" label="جمع ورودی‌ها" value={short(T.entry) + ' تومان'} />
        <Kpi icon="cup" label="فروش کافه در روز مسابقه‌ها" value={short(T.cafe) + ' تومان'} sub="جدا از فروش روزهای عادی" />
      </div>
      <div className="log-bar">
        <Search value={q} onChange={setQ} ph="عنوان مسابقه یا نام شرکت‌کننده" />
        <XlsxBtn onClick={exp} />
      </div>
      {months.map(({ k, rows: rs }) => (
        <Fragment key={k}>
          <h4 className="ev-month">{jMonthLabel(k)}</h4>
          <div className="ev-cards">
            {rs.map(({ e, entry, cafe, champ }) => (
              <button key={e.id} className={`ev-c ${e.status}`} onClick={() => onOpen(e.id)}>
                <div className="ev-c-img" style={{ backgroundImage: `url(${e.img})` }}>
                  <span className="ev-c-date"><b>{fa(+jDate(e.date).split('/')[2])}</b><small>{dayLabel(e.date)}</small></span>
                  <St s={e.status} />
                </div>
                <div className="ev-c-body">
                  <b>{e.title}</b>
                  <small>{hourLabel(e.start)} تا {hourLabel(e.start + e.dur)}، {courtsText(e.courts)}</small>
                  <div className="ev-cap-adm"><i style={{ width: `${Math.min(100, (e.regs.length / e.cap) * 100)}%` }} /></div>
                  <div className="ev-c-foot">
                    <span>{fa(e.regs.length)}/{fa(e.cap)} نفر</span>
                    {champ ? <span className="champ">🏆 {champ}</span> : <span>{short(entry + cafe)} درآمد</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Fragment>
      ))}
      {!list.length && <Empty>{w ? `مسابقه‌ای با «${w}» پیدا نشد.` : 'مسابقه‌ای در این فهرست نیست.'}</Empty>}
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
  const busy = isLive(ev) && fromKey(ev.date) >= fromKey(todayKey()) ? clashes(club.bookings, ev).filter((b) => !b.event) : []
  const setStatus = (status) => { adminEventSave({ id: ev.id, status }); chime('tap'); toast({ icon: '🏆', title: `«${ev.title}»: ${STATUS_HELP[status][0]}`, body: STATUS_HELP[status][1] }) }
  const del = () => {
    if (ev.regs.some((r) => r.paid > 0)) { if (window.confirm(`«${ev.title}» ورودی پرداخت‌شده دارد؛ لغو شود؟ زمین‌ها آزاد می‌شوند.`)) setStatus('cancelled'); return }
    if (window.confirm(`«${ev.title}» پاک شود؟`)) { adminEventDel(ev.id); onBack() }
  }
  const left = ev.matches.filter((m) => m.stage === 'group' && (m.sa == null || m.sa === m.sb)).length
  // مراحل برگزاری: هر مرحله زبانه‌ی خودش است؛ مرحله‌ی جاری اولین مرحله‌ی تمام‌نشده است
  const steps = [
    ['people', 'ثبت‌نام', `${fa(ev.regs.length)} از ${fa(ev.cap)} نفر`, ev.status !== 'open' && ev.status !== 'draft' && ev.regs.length >= 2],
    ['teams', 'تیم‌ها', ev.teams.length ? `${fa(ev.teams.length)} تیم` : 'هنوز چیده نشده', ev.teams.length > 0],
    ev.format === 'groups' && ['groups', 'گروه‌ها', !ev.groups.length ? 'طراحی نشده' : left ? `${fa(left)} بازی مانده` : 'همه نتیجه دارند', groupsDone(ev)],
    ['ko', 'حذفی', p ? 'فینال انجام شد' : ko ? 'در جریان' : 'هنوز ساخته نشده', !!p],
  ].filter(Boolean)
  const cur = ev.status === 'done' ? null : steps.find((s) => !s[3])
  const next = ev.status === 'done' ? ['برگزار شد؛ نتیجه‌ها و برنده‌ها در اپ دیده می‌شوند.']
    : !cur ? ['همه‌ی مراحل انجام شد.', 'ثبت پایان مسابقه', () => setStatus('done')]
    : cur[0] === 'people' ? [ev.status === 'draft' ? 'پیش‌نویس است و در اپ دیده نمی‌شود.' : 'ثبت‌نام باز است. وقتی ظرفیت پر شد یا زمانش رسید، ثبت‌نام را ببندید.', ev.status === 'draft' ? 'انتشار در اپ' : 'بستن ثبت‌نام و تیم‌بندی', () => { setStatus(ev.status === 'draft' ? 'open' : 'closed'); if (ev.status !== 'draft') setTab('teams') }]
    : cur[0] === 'teams' ? ['تیم‌هایی که دونفره ثبت‌نام کرده‌اند می‌مانند؛ بقیه هم‌سطح چیده می‌شوند.', 'رفتن به تیم‌ها', () => setTab('teams')]
    : cur[0] === 'groups' ? [ev.groups.length ? 'نتیجه‌ی بازی‌های گروهی را ثبت کنید.' : 'تعداد گروه و صعود از هر گروه را انتخاب کنید.', ev.groups.length ? 'رفتن به گروه‌ها' : 'طراحی گروه‌ها', () => setTab('groups')]
    : ['نتیجه‌ی بازی‌های حذفی را ثبت کنید تا قهرمان مشخص شود.', 'رفتن به حذفی', () => setTab(ko ? 'ko' : 'groups')]
  const waiting = singles(ev).filter((r) => !r.pair)
  const show = showsResults(ev)
  const leaders = ev.groups.map((g) => [g.id, standings(ev, g.id)[0]]).filter(([, r]) => r && r.p > 0)
  const lastKo = koRounds(ev).slice(-1)[0]
  const fin = ev.matches.find((m) => m.stage === 'ko' && m.round === 2)
  const setShow = (v) => { adminEventSave({ id: ev.id, showResults: v }); chime('tap'); toast({ icon: v ? '👁' : '🙈', title: v ? 'نتیجه‌ها در اپ نمایش داده می‌شود' : 'نتیجه‌ها در اپ پنهان شد', body: 'بازیکن‌ها فقط فهرست شرکت‌کننده‌ها را می‌بینند' }) }
  const work = [
    ['people', 'شرکت‌کننده‌ها', 'users', `${fa(ev.regs.length)} از ${fa(ev.cap)} نفر`,
      <div className="evw-avs">{ev.regs.slice(0, 9).map((r) => <i key={r.id} title={r.name}>{r.name[0]}</i>)}{ev.regs.length > 9 && <i>+{fa(ev.regs.length - 9)}</i>}</div>],
    ['teams', 'تیم‌ها', 'coach', ev.teams.length ? `${fa(ev.teams.length)} تیم` : 'هنوز تیمی نیست',
      <>{waiting.length > 0 && <em className="evw-warn">⏳ {fa(waiting.length)} نفر منتظر یار</em>}{ev.teams.slice(0, 3).map((t) => <small key={t.id}>{t.name}</small>)}</>],
    ev.format === 'groups' && ['groups', 'گروه‌ها و نتایج', 'grid', ev.groups.length ? `${fa(ev.groups.length)} گروه، ${left ? `${fa(left)} بازی مانده` : 'تمام شد'}` : 'طراحی نشده',
      <>{leaders.slice(0, 4).map(([g, r]) => <small key={g}><b>{g}</b> صدر: {r.name}</small>)}</>],
    ['ko', 'مرحله‌ی حذفی', 'trophy', p ? 'قهرمان مشخص شد' : lastKo ? ROUND[lastKo] : 'هنوز ساخته نشده',
      p ? <b className="evw-champ">🏆 {teamName(ev, p.first)}</b> : fin?.a && fin?.b ? <small>فینال: {teamName(ev, fin.a)} و {teamName(ev, fin.b)}</small> : null],
  ].filter(Boolean)
  return (
    <div className="stack">
      <button className="adm-btn ghost sm ev-back" onClick={onBack}><Icon name="fwd" size={16} />همه‌ی مسابقه‌ها</button>
      <div className="evb">
        <div className="evb-hero" style={{ backgroundImage: `url(${ev.img})` }}>
          <div className="evb-in">
            <div className="row-gap"><Badge tone={ev.kind === 'official' ? 'warn' : 'ok'}>{EVENT_KIND[ev.kind].name}</Badge><St s={ev.status} /></div>
            <h2>{ev.title}</h2>
            <div className="ev-facts">
              <span><Icon name="cal" size={14} />{when(ev)}</span>
              <span><Icon name="court" size={14} />{courtsText(ev.courts)}، در تقویم رزرو مسابقه</span>
              <span><Icon name="users" size={14} />سطح {ev.levels.join(' / ')}</span>
              <span><Icon name="cash" size={14} />{toman(ev.fee)} هر نفر؛ جایزه: {ev.prize}</span>
            </div>
            {busy.length > 0 && <p className="pt-warn">{fa(busy.length)} رزرو عادی در همین ساعت روی این زمین‌ها هست؛ در تقویم جابه‌جا یا لغوشان کنید.</p>}
            <div className="row-btns">
              <button className="adm-btn sm evb-btn" onClick={onEdit}><Icon name="cog" size={15} />ویرایش</button>
              <button className="adm-btn sm evb-btn" onClick={del}>{ev.regs.some((r) => r.paid > 0) ? 'لغو مسابقه' : 'حذف'}</button>
            </div>
          </div>
        </div>
        <div className="evb-k"><small>ثبت‌نام</small><b>{fa(ev.regs.length)}<span>/{fa(ev.cap)}</span></b><i className="evb-bar"><i style={{ width: `${Math.min(100, (ev.regs.length / ev.cap) * 100)}%` }} /></i><em>{fa(new Set(ev.regs.map((r) => r.pair || r.id)).size)} ثبت‌نام، {fa(waiting.length)} منتظر یار</em></div>
        <div className="evb-k"><small>ورودی‌ها</small><b>{short(entry)}</b><em>{toman(ev.fee)} هر نفر</em></div>
        <button className="evb-k cafe" onClick={() => setTab('cafe')}><small>☕ کافه‌ی روز مسابقه</small><b>{short(cafeT)}</b><em>{fa(cafe.length)} خرید</em></button>
        <div className={`evb-k ${p ? 'gold' : ''}`}><small>{p ? '🏆 قهرمان' : 'جمع درآمد'}</small><b className={p ? 'sm' : ''}>{p ? teamName(ev, p.first) : short(entry + cafeT)}</b><em>{p ? `نایب: ${teamName(ev, p.second)}` : 'ورودی + کافه'}</em></div>
        <div className="evb-k wide">
          <small>وضعیت در اپ</small>
          <div className="ev-st-opts">{['draft', 'open', 'closed', 'done'].map((k) => <button key={k} className={ev.status === k ? 'on' : ''} onClick={() => ev.status !== k && setStatus(k)}>{STATUS_HELP[k][0]}</button>)}</div>
          <em>{STATUS_HELP[ev.status][1]}</em>
        </div>
        <div className="evb-k wide">
          <small>نتیجه‌ها برای بازیکن‌ها</small>
          <div className="ev-st-opts">{[[true, 'نمایش در اپ'], [false, 'پنهان']].map(([v, n]) => <button key={n} className={show === v ? 'on' : ''} onClick={() => show !== v && setShow(v)}>{n}</button>)}</div>
          <em>{show ? 'تیم‌ها، جدول گروه‌ها، حذفی و قهرمان در اپ دیده می‌شود.' : 'در اپ فقط شرکت‌کننده‌ها دیده می‌شوند؛ نتیجه‌ها مخفی است.'}</em>
        </div>
      </div>
      <div className="evw">
        {work.map(([k, n, ic, sub, body], i) => {
          const ok = { people: steps[0]?.[3], teams: ev.teams.length > 0, groups: groupsDone(ev), ko: !!p }[k]
          return (
            <button key={k} className={`evw-t ${tab === k ? 'on' : ''} ${ok ? 'ok' : ''} ${cur?.[0] === k ? 'cur' : ''}`} onClick={() => setTab(k)}>
              <div className="evw-h"><span className="evw-n">{ok ? '✓' : fa(i + 1)}</span><Icon name={ic} size={16} /><b>{n}</b></div>
              <span className="evw-sub">{sub}</span>
              <div className="evw-body">{body}</div>
            </button>
          )
        })}
      </div>
      <div className={`ev-next ${ev.status === 'done' ? 'done' : ''}`}><span>{next[0]}</span>{next[1] && <button className="adm-btn primary sm" onClick={next[2]}>{next[1]}</button>}</div>
      {tab === 'people' && <People ev={ev} />}
      {tab === 'teams' && <TeamsTab ev={ev} go={setTab} />}
      {tab === 'groups' && <GroupsTab ev={ev} go={setTab} />}
      {tab === 'ko' && <KoTab ev={ev} go={setTab} />}
      {tab === 'cafe' && <CafeTab ev={ev} orders={cafe} />}
    </div>
  )
}

// ---------- ثبت‌نام‌ها: تیم‌های دونفره و ثبت‌نام حضوری ----------
function useWho(ev, exclude) {
  const [q, setQ] = useState('')
  const [m, setM] = useState(null)
  const [level, setLevel] = useState('C')
  const found = q && !m ? MEMBERS.filter((x) => !x.inactive && (x.name.includes(q) || x.phone.includes(q)) && !ev.regs.some((r) => r.by === x.id) && !exclude.includes(x.id)).slice(0, 5) : []
  const guest = q.trim()
  const person = m ? { by: m.id, name: m.name, level: m.level, phone: m.phone } : guest ? { by: 'f:' + guest, name: guest, level } : null
  return { q, setQ, m, setM, level, setLevel, found, guest, person, reset: () => { setQ(''); setM(null) } }
}
function WhoField({ label, w, hint }) {
  return (<>
    <Field label={label} hint={hint}>
      {w.m ? <div className="picked"><b>{w.m.name} <LevelPill id={w.m.level} /></b><button type="button" className="link" onClick={() => w.setM(null)}>تغییر</button></div>
        : <><input placeholder="جستجوی عضو یا نام مهمان" value={w.q} onChange={(e) => w.setQ(e.target.value)} />
          {w.found.length > 0 && <div className="pick-list">{w.found.map((m) => <button type="button" key={m.id} onClick={() => w.setM(m)}><b>{m.name}</b><small>{m.level}</small><small dir="ltr">{m.phone}</small></button>)}</div>}</>}
    </Field>
    {!w.m && w.guest && <Field label={`سطح ${w.guest}`} tip="برای تیم‌بندی هم‌سطح"><div className="pick-chips sm">{LEVELS.map((l) => <button key={l.id} type="button" className={w.level === l.id ? 'on' : ''} onClick={() => w.setLevel(l.id)}>{l.id}</button>)}</div></Field>}
  </>)
}

function People({ ev }) {
  const { adminEventReg, adminEventUnreg, toast } = useStore()
  const a = useWho(ev, [])
  const b = useWho(ev, [a.m?.id].filter(Boolean))
  const [method, setMethod] = useState('cash')
  const [each, setEach] = useState(ev.fee)
  const n = b.person ? 2 : 1
  const full = ev.regs.length + n > ev.cap
  const add = () => {
    adminEventReg(ev.id, a.person, method, method === 'free' ? 0 : each, b.person)
    chime('success'); toast({ icon: '🎾', title: b.person ? `تیم ${a.person.name} و ${b.person.name} ثبت شد` : `${a.person.name} ثبت‌نام شد`, body: method === 'free' ? 'بدون ورودی' : `${toman(each * n)}، ${METHOD_NAME[method]}` })
    a.reset(); b.reset()
  }
  const remove = (r) => {
    const mate = r.pair && ev.regs.find((x) => x.pair === r.pair && x.id !== r.id)
    if (!window.confirm(`${mate ? `تیم ${r.name} و ${mate.name}` : r.name} از مسابقه حذف شود؟${r.paid ? ' ورودی برگشت داده شده حساب می‌شود.' : ''}${ev.teams.length ? ' تیم‌بندی هم پاک می‌شود.' : ''}`)) return
    adminEventUnreg(ev.id, r.id)
  }
  // ثبت‌نام‌ها به ترتیب، هر زوج کنار هم
  const groups = []
  ev.regs.forEach((r) => { const k = r.pair || r.id; const g = groups.find((x) => x.k === k); if (g) g.rs.push(r); else groups.push({ k, rs: [r] }) })
  return (
    <div className="two wide-first">
      <Card title="ثبت‌نام‌ها" sub={`${fa(ev.regs.length)} از ${fa(ev.cap)} نفر، ${fa(groups.length)} ثبت‌نام؛ هر تیم دونفره یک پرداخت دارد`}>
        <div className="reg-list">
          {groups.map(({ k, rs }, i) => {
            const payer = rs[0].payer && rs.find((r) => r.by === rs[0].payer)
            return (
              <div key={k} className={`reg ${rs.length > 1 ? 'pair' : ''}`}>
                <em>{fa(i + 1)}</em>
                <div className="grow">
                  {rs.map((r) => <span key={r.id} className="reg-p"><b>{r.name}</b>{r.level && <LevelPill id={r.level} />}{r.by?.startsWith('f:') && <small>مهمان</small>}</span>)}
                  <small>{rs.length > 1 ? 'تیم دونفره' : 'تکی، یار با تیم‌بندی'}، {rs[0].source === 'app' ? 'از اپ' : 'حضوری'}، {jDateFa(dk(rs[0].at))}{payer ? `، پرداخت: ${payer.name.split(' ')[0]}` : ''}</small>
                </div>
                <span className="num">{rs[0].paid ? <>{toman(sum(rs, (r) => r.paid))}<small>{METHOD_NAME[rs[0].method] || rs[0].method}</small></> : 'رایگان'}</span>
                <button className="icon-btn" onClick={() => remove(rs[0])} aria-label="حذف" data-tip="حذف و برگرداندن ورودی"><Icon name="close" size={15} /></button>
              </div>
            )
          })}
        </div>
        {!ev.regs.length && <Empty>هنوز کسی ثبت‌نام نکرده.</Empty>}
      </Card>
      <Card title="ثبت‌نام حضوری" sub={ev.regs.length >= ev.cap ? 'ظرفیت تکمیل است' : `${fa(ev.cap - ev.regs.length)} جای خالی`}>
        <div className="form">
          <WhoField label="بازیکن (پرداخت‌کننده)" w={a} />
          {a.person && <WhoField label="یار" w={b} hint="اختیاری؛ اگر خالی بماند، در تیم‌بندی یار هم‌سطح می‌گیرد" />}
          <Field label="پرداخت"><Seg value={method} onChange={setMethod} options={{ cash: 'نقدی', card: 'کارتخوان', free: 'رایگان' }} /></Field>
          {method !== 'free' && <Field label="ورودی هر نفر" hint={n > 1 ? `جمع ${toman(each * n)} از ${a.person?.name}` : null}><Money value={each} onChange={setEach} /></Field>}
          <button className="adm-btn primary full" disabled={full || !a.person} onClick={add}>{b.person ? 'ثبت تیم' : 'ثبت‌نام'}</button>
        </div>
      </Card>
    </div>
  )
}

// ---------- تیم‌ها: تیم‌سازی دستی برای منتظرها، جفت‌کردن خودکار، جدا کردن ----------
function TeamsTab({ ev, go }) {
  const { adminEventSet, toast } = useStore()
  const [sel, setSel] = useState([])
  const started = ev.matches.some((m) => m.sa != null)
  // زوج‌های ثبت‌نامی خودکار تیم می‌شوند؛ «منتظر یار» فقط کسانی است که واقعاً یار ندارند
  const loose = loosePairs(ev).length
  useEffect(() => { if (loose && !started) adminEventSet(ev.id, withPairs) }, [loose, started])
  const wait = singles(ev).filter((r) => !r.pair)
  const ok = () => { if (started) { toast({ icon: '⚠️', title: 'بازی‌ها شروع شده‌اند', body: 'اول نتیجه‌ها را پاک کنید یا تیم‌بندی را از نو بچینید' }); return false } return !ev.groups.length || window.confirm('گروه‌ها و برنامه‌ی بازی پاک و باید دوباره ساخته شوند. ادامه؟') }
  const pick = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)))
  const make = () => { if (!ok()) return; adminEventSet(ev.id, (e) => pairUp(e, sel[0], sel[1])); setSel([]); chime('success'); toast({ icon: '🤝', title: 'تیم ساخته شد' }) }
  const auto = () => { if (!ok()) return; adminEventSet(ev.id, fillTeams); setSel([]); chime('success'); toast({ icon: '🎾', title: 'منتظرها جفت شدند', body: 'تیم‌های ساخته‌شده دست نخوردند؛ بقیه هم‌سطح جفت شدند' }) }
  const reset = () => { if (!window.confirm('همه‌ی تیم‌ها، گروه‌ها و نتیجه‌ها پاک و از نو چیده شوند؟')) return; adminEventSet(ev.id, makeTeams); chime('success') }
  const split = (t) => { if (!ok()) return; adminEventSet(ev.id, (e) => unpair(e, t.id)); chime('tap') }
  const reg = (id) => ev.regs.find((r) => r.id === id) || {}
  return (
    <div className="two wide-first">
      <Card title={`تیم‌ها ${ev.teams.length ? `(${fa(ev.teams.length)})` : ''}`} sub="تیم‌هایی که در اپ دونفره ثبت‌نام کرده‌اند با برچسب «ثبت‌نامی» مشخص‌اند"
        right={<div className="row-btns">
          {ev.teams.length > 0 && <button className="adm-btn ghost sm" onClick={reset} data-tip="همه از نو، بر اساس سطح">چیدن از نو</button>}
          {ev.teams.length > 1 && <button className="adm-btn primary sm" onClick={() => go(ev.format === 'knockout' ? 'ko' : 'groups')}>{ev.format === 'knockout' ? 'جدول حذفی' : 'طراحی گروه‌ها'}<Icon name="back" size={15} /></button>}
        </div>}>
        <div className="tm-grid">
          {ev.teams.map((t, i) => (
            <div key={t.id} className={`tm ${t.pair ? 'pair' : ''}`}>
              <div className="tm-h"><em>{fa(i + 1)}</em>{t.pair ? <span className="tm-tag">ثبت‌نامی</span> : <span className="tm-tag man">چیده‌شده</span>}
                <button className="icon-btn" onClick={() => split(t)} data-tip="جدا کردن؛ هر دو به «منتظر یار» برمی‌گردند" aria-label="جدا کردن"><Icon name="close" size={14} /></button></div>
              {t.players.map((pid) => { const r = reg(pid); return <div key={pid} className="tm-p"><b>{r.name}</b>{r.level && <LevelPill id={r.level} />}</div> })}
              <small>قدرت {fa(t.players.reduce((s, pid) => s + regPower(reg(pid)), 0))}</small>
            </div>
          ))}
        </div>
        {!ev.teams.length && <Empty>هنوز تیمی نیست. از ستون «منتظر یار» دو نفر را انتخاب کنید یا «جفت کردن خودکار» را بزنید.</Empty>}
      </Card>
      <Card title={`منتظر یار ${wait.length ? `(${fa(wait.length)})` : ''}`} sub={wait.length ? 'دو نفر را انتخاب کنید و «ساخت تیم» را بزنید' : 'همه تیم دارند'}>
        <div className="wt-list">
          {wait.map((r) => (
            <button key={r.id} className={`wt ${sel.includes(r.id) ? 'on' : ''}`} onClick={() => pick(r.id)}>
              <i>{sel.includes(r.id) ? fa(sel.indexOf(r.id) + 1) : ''}</i>
              <span className="grow"><b>{r.name}</b><small>{r.pair ? 'یار ثبت‌نامی دارد' : r.waiting ? 'در اپ: منتظر یار' : r.source === 'app' ? 'از اپ' : 'حضوری'}</small></span>
              {r.level && <LevelPill id={r.level} />}
            </button>
          ))}
        </div>
        {!wait.length && <div className="all-good"><Icon name="check" size={20} /><b>کسی منتظر یار نیست</b></div>}
        {wait.length > 0 && <div className="row-btns wt-act">
          <button className="adm-btn primary sm" disabled={sel.length !== 2} onClick={make}><Icon name="plus" size={15} />ساخت تیم</button>
          <button className="adm-btn ghost sm" disabled={wait.length < 2} onClick={auto} data-tip="منتظرها بر اساس سطح جفت می‌شوند؛ قوی‌ترین با ضعیف‌ترین">جفت کردن خودکار</button>
        </div>}
        {wait.length % 2 === 1 && <p className="pt-warn">{fa(wait.length)} نفر منتظرند؛ یک نفر بی‌یار می‌ماند.</p>}
      </Card>
    </div>
  )
}

// ---------- طراحی گروه‌ها: تعداد گروه، صعود از هر گروه، پیش‌نمایش زنده ----------
function Designer({ ev, onDone }) {
  const { adminEventSet, toast } = useStore()
  const n = ev.teams.length
  const maxG = Math.max(1, Math.floor(n / 2))
  const [g, setG] = useState(() => Math.min(maxG, ev.setup?.groups || Math.max(1, Math.round(n / 4))))
  const preview = useMemo(() => makeGroups(ev, { groups: g, advance: 99 }), [ev, g])
  const maxAdv = Math.min(...preview.groups.map((x) => x.teams.length))
  const [adv, setAdv] = useState(() => ev.setup?.advance || (g === 1 ? Math.min(4, n) : 2))
  const a = Math.min(adv, maxAdv)
  const pl = plan(n, g, a)
  const build = () => {
    if (ev.matches.length && !window.confirm('گروه‌ها و نتیجه‌های فعلی پاک و از نو ساخته شوند؟')) return
    adminEventSet(ev.id, (e) => makeGroups(e, { groups: g, advance: a }))
    chime('success'); toast({ icon: '🏆', title: `${fa(g)} گروه ساخته شد`, body: `${fa(pl.games)} بازی گروهی، ${fa(a)} تیم اول هر گروه صعود می‌کند` })
    onDone()
  }
  const steps = [1, 2, 3, 4, 5, 6, 8].filter((x) => x <= maxG)
  return (
    <div className="designer">
      <div className="ds-controls">
        <div><span className="lbl">تعداد گروه</span><div className="ds-chips">{steps.map((x) => <button key={x} className={g === x ? 'on' : ''} onClick={() => setG(x)}><b>{fa(x)}</b><small>{x === 1 ? 'یک جدول' : 'گروه'}</small></button>)}</div></div>
        <div><span className="lbl">صعود از هر گروه</span><div className="ds-chips">{Array.from({ length: Math.min(4, maxAdv) }, (_, i) => i + 1).map((x) => <button key={x} className={a === x ? 'on' : ''} onClick={() => setAdv(x)}><b>{fa(x)}</b><small>تیم اول</small></button>)}</div></div>
      </div>
      <div className="ds-flow">
        <div className="ds-node"><small>تیم‌ها</small><b>{fa(n)}</b></div><i />
        <div className="ds-node"><small>گروه‌ها</small><b>{fa(g)} گروه</b><em>{fa(pl.per)}{pl.extra ? `–${fa(pl.per + 1)}` : ''} تیمی، {fa(pl.games)} بازی</em></div><i />
        <div className="ds-node hot"><small>صعود</small><b>{fa(pl.q)} تیم</b>{pl.byes > 0 && <em>{fa(pl.byes)} استراحت</em>}</div><i />
        <div className="ds-node"><small>شروع حذفی</small><b>{ROUND[pl.size] || `${fa(pl.size)} تیمی`}</b><em>{fa(pl.koGames)} بازی</em></div><i />
        <div className="ds-node gold"><small>قهرمان</small><b>🏆</b></div>
      </div>
      <div className="ds-groups">
        {preview.groups.map((gr, i) => (
          <div key={gr.id} className="ds-g" style={{ '--h': (i * 57) % 360 }}>
            <h5><span>{gr.id}</span>گروه {gr.id}<small>{fa(gr.teams.length)} تیم</small></h5>
            {gr.teams.map((t, k) => <div key={t} className={k < a ? 'up' : ''}><em>{fa(k + 1)}</em>{teamName(ev, t)}</div>)}
          </div>
        ))}
      </div>
      <p className="muted-note">تیم‌ها به ترتیب قدرت مار‌پیچ پخش می‌شوند تا گروه‌ها هم‌سطح باشند. ردیف‌های رنگی فقط نشان می‌دهند چند تیم صعود می‌کنند؛ ترتیب واقعی با نتیجه‌ها مشخص می‌شود.</p>
      <div className="row-btns"><button className="adm-btn primary" onClick={build}>{ev.groups.length ? 'ساخت دوباره‌ی گروه‌ها' : 'ساخت گروه‌ها و برنامه‌ی بازی'}</button>{ev.groups.length > 0 && <button className="adm-btn ghost" onClick={onDone}>انصراف</button>}</div>
    </div>
  )
}

function GroupsTab({ ev, go }) {
  const { adminEventSet, toast } = useStore()
  const [design, setDesign] = useState(!ev.groups.length)
  const score = (id, a, b) => adminEventSet(ev.id, (e) => setScore(e, id, a, b))
  const done = groupsDone(ev)
  const left = ev.matches.filter((m) => m.stage === 'group' && (m.sa == null || m.sa === m.sb)).length
  const adv = ev.setup?.advance || (ev.groups.length === 1 ? 4 : 2)
  const ko = () => {
    if (ev.matches.some((m) => m.stage === 'ko') && !window.confirm('جدول حذفی فعلی پاک و از نو ساخته شود؟')) return
    if (!done && !window.confirm(`${fa(left)} بازی گروهی هنوز نتیجه ندارد. با جدول فعلی جدول حذفی ساخته شود؟`)) return
    adminEventSet(ev.id, (e) => makeKnockout({ ...e, matches: e.matches.filter((m) => m.stage === 'group') }))
    chime('success'); toast({ icon: '🏆', title: 'جدول حذفی ساخته شد', body: `${fa(adv)} تیم اول هر گروه` }); go('ko')
  }
  if (ev.teams.length < 2) return <Card><Empty>اول در «تیم‌ها» تیم‌بندی کنید.</Empty></Card>
  if (design || !ev.groups.length) return <Card title="طراحی گروه‌ها" sub="چند گروه باشد و از هر گروه چند تیم به حذفی برود؛ نتیجه را همین‌جا می‌بینید"><Designer ev={ev} onDone={() => setDesign(false)} /></Card>
  return (
    <Card title="گروه‌ها و نتایج" sub={done ? 'همه‌ی بازی‌های گروهی نتیجه دارند' : `نتیجه را بنویسید (گیم‌های هر تیم)؛ ${fa(left)} بازی مانده`}
      right={<div className="row-btns"><button className="adm-btn ghost sm" onClick={() => setDesign(true)}>طراحی دوباره</button><button className={`adm-btn ${done ? 'primary' : 'ghost'} sm`} onClick={ko}>ساخت مرحله‌ی حذفی</button></div>}>
      <p className="ds-banner">از هر گروه <b>{fa(adv)} تیم اول</b> به مرحله‌ی حذفی می‌روند؛ ردیف‌های سبز الان در جای صعودند.</p>
      <GroupMembers ev={ev} />
      <Groups ev={ev} onScore={score} />
    </Card>
  )
}

function GroupMembers({ ev }) {
  const { adminEventSet, toast } = useStore()
  const where = (tid) => ev.groups.find((g) => g.teams.includes(tid))?.id || ''
  const outside = ev.teams.filter((t) => !where(t.id))
  const move = (tid, gid) => {
    const from = where(tid)
    const hit = ev.matches.some((m) => m.stage === 'group' && [from, gid].includes(m.group) && m.sa != null)
    if (hit && !window.confirm('نتیجه‌های ثبت‌شده‌ی این گروه‌ها پاک می‌شود و برنامه‌ی بازی‌شان از نو ساخته می‌شود. ادامه؟')) return
    adminEventSet(ev.id, (e) => moveTeam(e, tid, gid || null)); chime('tap')
    toast({ icon: '🔀', title: gid ? `به گروه ${gid} رفت` : 'از گروه‌ها بیرون آمد', body: 'برنامه‌ی بازی همان گروه‌ها به‌روز شد' })
  }
  return (
    <details className="gm" open={outside.length > 0}>
      <summary>ویرایش اعضای گروه‌ها{outside.length > 0 && <em>{fa(outside.length)} تیم بیرون از گروه‌ها</em>}</summary>
      <div className="gm-list">
        {ev.teams.map((t) => (
          <label key={t.id} className={where(t.id) ? '' : 'out'}><b>{t.name}</b>
            <select value={where(t.id)} onChange={(e) => move(t.id, e.target.value)}><option value="">بیرون از گروه‌ها</option>{ev.groups.map((g) => <option key={g.id} value={g.id}>گروه {g.id}</option>)}</select>
          </label>
        ))}
      </div>
    </details>
  )
}

function KoTab({ ev, go }) {
  const { adminEventSet, toast } = useStore()
  const score = (id, a, b) => adminEventSet(ev.id, (e) => setScore(e, id, a, b))
  if (!ev.matches.some((m) => m.stage === 'ko')) {
    if (ev.format === 'knockout' && ev.teams.length > 1) {
      const pl = plan(ev.teams.length, 1, ev.teams.length)
      const build = () => { adminEventSet(ev.id, (e) => makeKnockout({ ...e, groups: [], matches: [] })); chime('success'); toast({ icon: '🏆', title: 'جدول حذفی ساخته شد' }) }
      return <Card title="جدول حذفی"><div className="ds-flow"><div className="ds-node"><small>تیم‌ها</small><b>{fa(ev.teams.length)}</b></div><i /><div className="ds-node hot"><small>شروع</small><b>{ROUND[pl.size] || `${fa(pl.size)} تیمی`}</b>{pl.byes > 0 && <em>{fa(pl.byes)} استراحت</em>}</div><i /><div className="ds-node gold"><small>قهرمان</small><b>🏆</b></div></div><button className="adm-btn primary" onClick={build}>ساخت جدول حذفی</button></Card>
    }
    return <Card><Empty>{ev.format === 'groups' ? 'بعد از بازی‌های گروهی، در «گروه‌ها» مرحله‌ی حذفی را بسازید.' : 'اول در «تیم‌ها» تیم‌بندی کنید.'}{ev.groups.length > 0 && <><br /><button className="adm-btn ghost sm" onClick={() => go('groups')}>رفتن به گروه‌ها</button></>}</Empty></Card>
  }
  return (
    <Card title="مرحله‌ی حذفی" sub="برنده‌ی هر بازی خودکار به دور بعد می‌رود؛ اگر نتیجه‌ای را عوض کنید، دورهای بعد از نو ساخته می‌شوند">
      <Bracket ev={ev} onScore={score} />
    </Card>
  )
}

function CafeTab({ ev, orders }) {
  const { user } = useStore()
  const top = {}
  orders.forEach((o) => o.items.forEach((x) => { top[x.name] = (top[x.name] || 0) + x.qty }))
  return (
    <div className="two wide-first">
      <Card title="خریدهای کافه در روز مسابقه" sub={`${dayLabel(ev.date)} ${jDateFa(ev.date)}، کل روز؛ جدا از فروش روزهای عادی`}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>سفارش</th><th>مشتری</th><th>اقلام</th><th>مبلغ</th></tr></thead>
          <tbody>{orders.map((o) => <tr key={o.id}><td><b dir="ltr">{o.id}</b><small>{time.format(o.at)}</small></td><td>{who(o.by, user)}</td><td><small>{o.items.map((x) => `${fa(x.qty)}× ${x.name}`).join('، ')}</small></td><td className="num">{toman(o.total)}</td></tr>)}</tbody>
        </table></div>
        {!orders.length && <Empty>در روز این مسابقه خریدی از کافه ثبت نشده.</Empty>}
      </Card>
      <Card title="پرفروش‌های روز مسابقه">
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
  const [f, setF] = useState(() => ev || { kind: 'friday', title: 'آدینه‌ی کوادرا', desc: 'تیم‌های دونفره، گروهی + حذفی', format: 'groups', date: nextFriday(), start: 9, dur: 3, courts: [1, 2, 3, 4], levels: ['B', 'C+', 'C'], cap: 16, fee: 750000, prize: 'راکت + توپ', img: EV_IMG[0], status: 'open', note: '' })
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const tog = (k, v) => set({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v].sort() })
  const same = eventAt(club.events.filter((e) => e.id !== ev?.id), fromKey(f.date).getTime() + f.start * 36e5)
  const busy = clashes(club.bookings, { ...f, id: ev?.id }).filter((b) => !b.event)
  const custom = f.img && !EV_IMG.includes(f.img)
  const ok = f.title.trim() && f.date && f.cap > 1 && f.courts.length && f.levels.length
  const save = () => {
    const s = adminEventSave({ ...f, title: f.title.trim(), id: ev?.id })
    chime('success'); toast({ icon: '🏆', title: ev ? 'مسابقه به‌روز شد' : 'مسابقه ساخته شد', body: f.status === 'draft' ? 'پیش‌نویس؛ هنوز در اپ دیده نمی‌شود' : `در اپ دیده می‌شود؛ ${courtsText(f.courts)} در تقویم رزرو شد` })
    onClose(s.id)
  }
  return (
    <div className="form">
      <Field label="نوع"><Seg value={f.kind} onChange={(kind) => set({ kind, ...(ev ? {} : kind === 'official' ? { title: 'تورنمنت کوادرا', desc: 'گروهی + حذفی، امتیاز رنکینگ', start: 10, dur: 8, cap: 32, fee: 1500000, prize: 'جایزه‌ی نقدی + جام', levels: ['A', 'B+', 'B', 'C+'] } : { title: 'آدینه‌ی کوادرا', desc: 'تیم‌های دونفره، گروهی + حذفی', start: 9, dur: 3, cap: 16, fee: 750000 }) })} options={{ friday: 'مسابقه‌ی آدینه', official: 'تورنمنت رسمی' }} /></Field>
      <Field label="اسم مسابقه"><input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثلاً آدینه‌ی بانوان" /></Field>
      <Field label="توضیح کوتاه" hint="زیر اسم در اپ نشان داده می‌شود"><input value={f.desc} onChange={(e) => set({ desc: e.target.value })} /></Field>

      <h4 className="form-sec">روز، ساعت و زمین‌ها <small>همین ساعت‌ها در تقویم برای مسابقه رزرو می‌شود</small></h4>
      <div className="form-3">
        <Field label="روز" hint={`${dayLabel(f.date)} ${jDateFa(f.date)}`}><input type="date" value={toInput(f.date)} onChange={(e) => e.target.value && set({ date: fromInput(e.target.value) })} /></Field>
        <Field label="از ساعت"><select value={f.start} onChange={(e) => set({ start: +e.target.value })}>{Array.from({ length: 16 }, (_, i) => i + 7).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></Field>
        <Field label="تا ساعت"><select value={f.start + f.dur} onChange={(e) => set({ dur: +e.target.value - f.start })}>{Array.from({ length: 24 - f.start }, (_, i) => f.start + i + 1).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></Field>
      </div>
      <Field label="زمین‌های مسابقه"><div className="pick-chips">
        <button type="button" className={f.courts.length === 4 ? 'on' : ''} onClick={() => set({ courts: f.courts.length === 4 ? [] : [1, 2, 3, 4] })}>همه‌ی زمین‌ها</button>
        {[1, 2, 3, 4].map((c) => <button key={c} type="button" className={f.courts.includes(c) && f.courts.length < 4 ? 'on' : ''} onClick={() => set({ courts: f.courts.length === 4 ? [c] : f.courts.includes(c) ? f.courts.filter((x) => x !== c) : [...f.courts, c].sort() })}>زمین {fa(c)}</button>)}
      </div></Field>
      <div className="ev-hold"><Icon name="cal" size={15} />{f.courts.length ? <>{courtsText(f.courts)}، {dayLabel(f.date)} {hourLabel(f.start)} تا {hourLabel(f.start + f.dur)} در تقویم «🏆 {f.title || 'مسابقه'}» می‌شود و کسی در اپ نمی‌تواند رزرو کند.</> : 'حداقل یک زمین انتخاب کنید.'}</div>
      {busy.length > 0 && <div className="pt-warn"><b>{fa(busy.length)} رزرو در همین ساعت هست:</b> {busy.slice(0, 4).map((b) => `زمین ${fa(b.court)} ${hourLabel(b.start)} (${who(b.by) || b.note || ''})`).join('، ')}{busy.length > 4 ? '، …' : ''}. بعد از ذخیره در تقویم جابه‌جا یا لغوشان کنید.</div>}
      {same && <p className="pt-warn">در همین روز «{same.title}» هم هست؛ فروش کافه‌ی آن روز به اولی نسبت داده می‌شود.</p>}

      <h4 className="form-sec">شرکت‌کننده‌ها و جایزه</h4>
      <Field label="سطح‌های مجاز"><div className="pick-chips sm">{LEVELS.map((l) => <button key={l.id} type="button" className={f.levels.includes(l.id) ? 'on' : ''} onClick={() => tog('levels', l.id)}>{l.id}</button>)}</div></Field>
      <Field label="روش برگزاری"><Seg value={f.format} onChange={(format) => set({ format })} options={EV_FORMAT} tips={{ groups: 'اول دوره‌ای در گروه‌ها، بعد حذفی', knockout: 'از اول حذفی' }} /></Field>
      <div className="form-3">
        <Field label="ظرفیت (نفر)" hint={`${fa(Math.floor(f.cap / 2))} تیم دونفره`}><input type="number" min="2" step="2" value={f.cap} onChange={(e) => set({ cap: +e.target.value })} /></Field>
        <Field label="ورودی هر نفر" hint={`هر تیم ${toman(f.fee * 2)}`}><Money value={f.fee} onChange={(fee) => set({ fee })} /></Field>
        <Field label="جایزه"><input value={f.prize} onChange={(e) => set({ prize: e.target.value })} /></Field>
      </div>

      <h4 className="form-sec">عکس و انتشار</h4>
      <ImageUpload value={custom ? f.img : null} onChange={(img) => set({ img: img || EV_IMG[0] })} hint="عکس افقی زمین یا پوستر مسابقه" />
      <Field label="یا یکی از عکس‌های آماده"><div className="ev-imgs">{EV_IMG.map((s) => <button key={s} type="button" className={f.img === s ? 'on' : ''} style={{ backgroundImage: `url(${s})` }} onClick={() => set({ img: s })} aria-label="عکس" />)}</div></Field>
      <Field label="یادداشت برای بازیکن‌ها" hint="اختیاری؛ مثلاً «۱۵ دقیقه زودتر بیایید»"><input value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
      <Field label="انتشار"><div className="ev-st-opts form">{['draft', 'open', 'closed'].map((k) => <button key={k} type="button" className={f.status === k ? 'on' : ''} onClick={() => set({ status: k })}>{STATUS_HELP[k][0]}</button>)}</div><small className="ev-st-help">{STATUS_HELP[f.status][1]}</small></Field>
      <button className="adm-btn primary full" disabled={!ok} onClick={save}>{ev ? 'ذخیره' : 'ساخت مسابقه'}</button>
    </div>
  )
}
