// نمایش مسابقه برای اپ و پنل مدیر: سکوی قهرمانی، جدول گروه‌ها، جدول حذفی و تیم‌ها
// اگر onScore داده شود (پنل مدیر)، نتیجه‌ی هر بازی قابل ثبت است.
import { useState } from 'react'
import { fa, levelById } from '../data'
import { ROUND, koRounds, podium, scored, standings, teamName, teamOf, winnerOf } from '../events'

export function Podium({ ev }) {
  const p = podium(ev)
  if (!p) return null
  return (
    <div className="trn-podium">
      <div className="tp second"><i>🥈</i><b>{teamName(ev, p.second)}</b><small>نایب‌قهرمان</small></div>
      <div className="tp first"><i>🏆</i><b>{teamName(ev, p.first)}</b><small>قهرمان</small></div>
      <div className="tp third"><i>🥉</i><b>{p.third.map((t) => teamName(ev, t)).join('، ') || '—'}</b><small>سوم</small></div>
    </div>
  )
}

export function Teams({ ev, onPick, picked }) {
  return (
    <div className="trn-teams">
      {ev.teams.map((t, i) => (
        <div key={t.id} className="trn-team">
          <em>{fa(i + 1)}</em>
          <div className="grow">{t.players.map((p) => {
            const r = ev.regs.find((x) => x.id === p)
            const Tag = onPick ? 'button' : 'span'
            return <Tag key={p} type={onPick ? 'button' : undefined} className={`trn-pl ${picked === p ? 'on' : ''}`} onClick={onPick && (() => onPick(p))}>{r?.name || '—'}{r?.level && <small style={{ color: levelById(r.level).color }}>{r.level}</small>}</Tag>
          })}{t.players.length < 2 && <span className="trn-pl miss">بدون یار</span>}</div>
        </div>
      ))}
    </div>
  )
}

// عدد فارسی یا انگلیسی، حداکثر دو رقم
const digits = (v) => v.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d]/g, '').slice(0, 2)

function Match({ ev, m, onScore }) {
  const w = winnerOf(m)
  // ویرایش: هر تیم ورودی گیم خودش را کنار اسمش دارد؛ وقتی هر دو پر و نابرابر شد ذخیره می‌شود
  const [s, setS] = useState({ a: m.sa ?? '', b: m.sb ?? '' })
  const put = (k, v) => {
    const n = { ...s, [k]: digits(v) }
    setS(n)
    if (n.a !== '' && n.b !== '' && +n.a !== +n.b) onScore(m.id, +n.a, +n.b)
    else if (n.a === '' && n.b === '') onScore(m.id, null, null)
  }
  const side = (id, k, score) => (
    <div className={`trn-side ${w && w === id ? 'win' : ''} ${!id ? 'tbd' : ''}`}>
      <span>{id ? teamName(ev, id) : 'منتظر نتیجه'}</span>
      {onScore && k ? <input className="trn-in" inputMode="numeric" value={s[k]} onChange={(e) => put(k, e.target.value)} aria-label={`گیم ${id ? teamName(ev, id) : ''}`} /> : <b>{score ?? ''}</b>}
    </div>
  )
  if (m.b == null) return <div className="trn-match bye">{side(m.a)}<small>استراحت؛ مستقیم به دور بعد</small></div>
  return (
    <div className={`trn-match ${scored(m) ? 'done' : ''} ${onScore ? 'edit' : ''}`}>
      {m.court && <small className="trn-court">زمین {fa(m.court)}</small>}
      <div className="trn-pair">{side(m.a, 'a', m.sa)}{side(m.b, 'b', m.sb)}</div>
      {onScore && s.a !== '' && s.b !== '' && +s.a === +s.b && <small className="trn-tie">نتیجه مساوی ثبت نمی‌شود</small>}
    </div>
  )
}

export function Groups({ ev, onScore }) {
  if (!ev.groups.length) return null
  return (
    <div className="trn-groups">
      {ev.groups.map((g) => (
        <div key={g.id} className="trn-group" style={{ '--h': (ev.groups.indexOf(g) * 57) % 360 }}>
          <h4><span className="trn-gl">{g.id}</span>گروه {g.id}</h4>
          <table className="trn-table">
            <thead><tr><th>#</th><th>تیم</th><th>بازی</th><th>برد</th><th>باخت</th><th>تفاضل</th></tr></thead>
            <tbody>{standings(ev, g.id).map((r, i) => (
              <tr key={r.id} className={i < (ev.setup?.advance || (ev.groups.length === 1 ? 4 : 2)) ? 'up' : ''}><td>{fa(i + 1)}</td><td>{r.name}{i < (ev.setup?.advance || (ev.groups.length === 1 ? 4 : 2)) && <em className="trn-up">صعود</em>}</td><td>{fa(r.p)}</td><td>{fa(r.w)}</td><td>{fa(r.l)}</td><td dir="ltr">{r.gf - r.ga > 0 ? '+' : ''}{fa(r.gf - r.ga)}</td></tr>
            ))}</tbody>
          </table>
          <div className="trn-ms">{ev.matches.filter((m) => m.stage === 'group' && m.group === g.id).map((m) => <Match key={`${m.id}-${m.a}-${m.b}`} ev={ev} m={m} onScore={onScore} />)}</div>
        </div>
      ))}
    </div>
  )
}

export function Bracket({ ev, onScore }) {
  const rounds = koRounds(ev)
  if (!rounds.length) return null
  return (
    <div className="trn-bracket">
      {rounds.map((r) => (
        <div key={r} className="trn-round">
          <h4>{ROUND[r] || `دور ${fa(r)} تیمی`}</h4>
          {ev.matches.filter((m) => m.stage === 'ko' && m.round === r).sort((a, b) => a.idx - b.idx).map((m) => <Match key={`${m.id}-${m.a}-${m.b}`} ev={ev} m={m} onScore={onScore} />)}
        </div>
      ))}
    </div>
  )
}

export const champion = (ev) => { const p = podium(ev); return p ? teamOf(ev, p.first) : null }
