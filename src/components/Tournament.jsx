// نمایش مسابقه برای اپ و پنل مدیر: سکوی قهرمانی، جدول گروه‌ها، جدول حذفی و تیم‌ها
// اگر onScore داده شود (پنل مدیر)، نتیجه‌ی هر بازی قابل ثبت است.
import { useState } from 'react'
import { fa, levelById } from '../data'
import { ROUND, judge, koRounds, podium, scored, scoringOf, setsOf, standings, teamName, teamOf, winnerOf } from '../events'

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

// هر بازی ست به ست: هر تیم برای هر ست یک خانه‌ی گیم دارد؛ وقتی نتیجه طبق قانون کامل شد ذخیره می‌شود
export function Match({ ev, m, onScore }) {
  const sc = scoringOf(ev)
  const w = winnerOf(m)
  const saved = setsOf(m)
  const [raw, setD] = useState(() => Array.from({ length: sc.sets }, (_, i) => (saved[i] ? [String(saved[i][0]), String(saved[i][1])] : ['', ''])))
  // اگر روش امتیاز عوض شود تعداد ست‌ها فرق می‌کند؛ ردیف‌ها همیشه به اندازه‌ی روش فعلی‌اند
  const d = Array.from({ length: sc.sets }, (_, i) => raw[i] || ['', ''])
  const full = (rows) => rows.filter(([x, y]) => x !== '' && y !== '').map(([x, y]) => [+x, +y])
  const r = judge(ev, full(d))
  const put = (i, t, v) => {
    const n = d.map((x, j) => (j === i ? (t ? [x[0], digits(v)] : [digits(v), x[1]]) : x))
    setD(n)
    const sets = full(n), res = judge(ev, sets)
    if (!sets.length) { if (saved.length) onScore(m.id, null) } else if (res.done || m.sa != null) onScore(m.id, sets)
  }
  // ست سوم فقط وقتی لازم است که دو ست اول یکی‌یکی شده باشد
  const n = onScore ? (sc.sets === 1 ? 1 : d[2]?.some((x) => x !== '') || (r.a === 1 && r.b === 1) ? 3 : 2) : saved.length
  const side = (t) => {
    const id = t ? m.b : m.a
    return (
      <div className={`trn-side ${w && w === id ? 'win' : ''} ${!id ? 'tbd' : ''}`}>
        <span>{id ? teamName(ev, id) : 'منتظر نتیجه'}</span>
        <div className="trn-sets">{Array.from({ length: n }, (_, i) => (onScore
          ? <input key={i} className={`trn-in ${sc.stb && i === 2 ? 'stb' : ''}`} inputMode="numeric" value={d[i][t] && fa(d[i][t])} onChange={(e) => put(i, t, e.target.value)} aria-label={`${sc.stb && i === 2 ? 'سوپرتای‌بریک' : `ست ${i + 1}`} ${id ? teamName(ev, id) : ''}`} />
          : <b key={i} className={saved[i][t] > saved[i][1 - t] ? 'w' : ''}>{fa(saved[i][t])}</b>))}</div>
      </div>
    )
  }
  if (m.b == null) return <div className="trn-match bye"><div className="trn-side"><span>{teamName(ev, m.a)}</span></div><small>استراحت؛ مستقیم به دور بعد</small></div>
  return (
    <div className={`trn-match ${scored(m) ? 'done' : ''} ${onScore ? 'edit' : ''}`}>
      {m.court && <small className="trn-court">زمین {fa(m.court)}</small>}
      {onScore && sc.sets > 1 && <div className="trn-sh">{Array.from({ length: n }, (_, i) => <small key={i}>{sc.stb && i === 2 ? 'تای‌بریک' : `ست ${fa(i + 1)}`}</small>)}</div>}
      <div className="trn-pair">{side(0)}{side(1)}</div>
      {onScore && r.why && <small className="trn-tie">{r.why}</small>}
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
            <thead><tr><th>#</th><th>تیم</th><th>بازی</th><th>برد</th><th>ست</th><th>گیم</th><th>امتیاز</th></tr></thead>
            <tbody>{standings(ev, g.id).map((r, i) => (
              <tr key={r.id} className={i < (ev.setup?.advance || (ev.groups.length === 1 ? 4 : 2)) ? 'up' : ''}><td>{fa(i + 1)}</td><td>{r.name}{i < (ev.setup?.advance || (ev.groups.length === 1 ? 4 : 2)) && <em className="trn-up">صعود</em>}</td><td>{fa(r.p)}</td><td>{fa(r.w)}</td><td dir="ltr">{r.sf - r.sa > 0 ? '+' : ''}{fa(r.sf - r.sa)}</td><td dir="ltr">{r.gf - r.ga > 0 ? '+' : ''}{fa(r.gf - r.ga)}</td><td><b>{fa(r.w)}</b></td></tr>
            ))}</tbody>
          </table>
          <div className="trn-ms">{ev.matches.filter((m) => m.stage === 'group' && m.group === g.id).map((m) => <Match key={`${m.id}-${m.a}-${m.b}`} ev={ev} m={m} onScore={onScore} />)}</div>
        </div>
      ))}
    </div>
  )
}

// جدول حذفی: هر دو بازی با یک براکت به بازی دور بعد وصل می‌شوند و مسیر به کارت قهرمان می‌رسد
export function Bracket({ ev, onScore }) {
  const rounds = koRounds(ev)
  if (!rounds.length) return null
  const p = podium(ev)
  return (
    <div className="br">
      {rounds.map((r) => {
        const ms = ev.matches.filter((m) => m.stage === 'ko' && m.round === r).sort((x, y) => x.idx - y.idx)
        const pairs = []
        for (let i = 0; i < ms.length; i += 2) pairs.push(ms.slice(i, i + 2))
        return (
          <div key={r} className={`br-round ${r === 2 ? 'final' : ''}`}>
            <h4>{ROUND[r] || `دور ${fa(r)} تیمی`}<small>{fa(ms.filter((m) => winnerOf(m)).length)} از {fa(ms.length)}</small></h4>
            <div className="br-col">
              {pairs.map((pr, i) => (
                <div key={i} className={`br-pair ${pr.length === 2 ? 'two' : ''}`}>
                  {pr.map((m) => <Match key={`${m.id}-${m.a}-${m.b}`} ev={ev} m={m} onScore={onScore} />)}
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <div className="br-round champ">
        <h4>قهرمان</h4>
        <div className="br-col"><div className={`br-champ ${p ? 'on' : ''}`}><i>🏆</i><b>{p ? teamName(ev, p.first) : '؟'}</b><small>{p ? 'قهرمان مسابقه' : 'بعد از فینال مشخص می‌شود'}</small></div></div>
      </div>
    </div>
  )
}

export const champion = (ev) => { const p = podium(ev); return p ? teamOf(ev, p.first) : null }
