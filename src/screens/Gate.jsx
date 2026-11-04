import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { LEVELS, SIDES, fa } from '../data'
import { celebrate, chime, haptic } from '../fx'
import { useStore } from '../store'
import { Button, Icon, LevelPill, Photo, TopBar } from '../components/ui'
import { Emblem, Loading, QuadraMark } from '../components/Logo'

const toLatin = (s) => s.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
const fa0 = (s) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])

export default function Gate() {
  const { loginPlayer, hasAccount } = useStore()
  const [step, setStep] = useState('welcome') // welcome → phone → otp → name → level → done | admin
  const [mode, setMode] = useState('signup')
  const [dir, setDir] = useState(1)
  const [form, setForm] = useState({ phone: '', name: '', level: null, side: null })
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  const order = ['welcome', 'phone', 'otp', 'name', 'level', 'side', 'done']
  const go = (s) => { setDir(order.indexOf(s) >= order.indexOf(step) ? 1 : -1); setStep(s) }
  const back = () => go(step === 'admin' || step === 'coach' ? 'welcome' : order[order.indexOf(step) - 1])
  const afterOtp = () => {
    // عضو قبلی فقط با شماره و کد وارد می‌شود — بدون پرسیدن نام و سطح
    if (mode === 'login' || hasAccount(form.phone)) { loginPlayer({ phone: form.phone }); return }
    go('name')
  }
  const finish = () => { celebrate(); chime('level'); haptic([20, 40, 20]); go('done') }
  const progress = { phone: 0, otp: 1, name: 2, level: 3, side: 4 }[step]

  return (
    <div className="auth">
      <HeroSlides dim={step !== 'welcome'} admin={step === 'admin' || step === 'coach'} />
      <AnimatePresence mode="popLayout" custom={dir} initial={false}>
        <motion.div key={step} className={`auth-pane ${step === 'welcome' ? 'welcome' : ''}`} custom={dir}
          variants={{ in: (d) => ({ x: d * -60, opacity: 0 }), on: { x: 0, opacity: 1 }, out: (d) => ({ x: d * 60, opacity: 0 }) }}
          initial="in" animate="on" exit="out" transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
          {step === 'welcome' && <Welcome onStart={() => { setMode('signup'); go('phone') }} onLogin={() => { setMode('login'); go('phone') }} onAdmin={() => go('admin')} onCoach={() => go('coach')} />}
          {step === 'admin' && <AdminLogin onBack={back} />}
          {step === 'coach' && <AdminLogin coach onBack={back} />}
          {!['welcome', 'done', 'admin', 'coach'].includes(step) && (
            <div className="auth-card">
              <TopBar onBack={back} total={5} step={progress} title={mode === 'login' && step === 'phone' ? 'ورود' : 'عضویت در کوادرا'} transparent />
              {step === 'phone' && <PhoneStep value={form.phone} onChange={(phone) => set({ phone })} onNext={() => go('otp')} mode={mode} />}
              {step === 'otp' && <OtpStep phone={form.phone} onNext={afterOtp} />}
              {step === 'name' && <NameStep form={form} set={set} onNext={() => go('level')} />}
              {step === 'level' && <LevelStep value={form.level} onChange={(level) => set({ level })} onNext={() => go('side')} />}
              {step === 'side' && <SideStep value={form.side} onChange={(side) => set({ side })} onNext={finish} />}
            </div>
          )}
          {step === 'done' && <Done form={form} onEnter={() => loginPlayer({ ...form, joined: Date.now() })} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ذرات گرد و غبار در نور — موقعیت‌ها ثابت تا با هر رندر عوض نشوند
// پس‌زمینه‌ی ویدیویی: نمای هوایی زمین پدل (Pexels، Gianluca Guidi)
function HeroSlides({ dim, admin }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    // اگر کاربر حرکت کم را ترجیح داده، فقط تصویر ثابت
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { v.pause(); return }
    v.play?.().catch(() => {})
  }, [])
  return (
    <div className="auth-bg">
      <img className="bg-poster" src="./img/welcome-video.jpg" alt="" draggable={false} />
      <video ref={ref} className={`bg-video ${ready ? 'on' : ''}`} src="./img/welcome-video.mp4" poster="./img/welcome-video.jpg"
        autoPlay muted loop playsInline preload="auto" onCanPlay={() => setReady(true)} aria-hidden="true" />
      <div className={`auth-bg-shade ${dim ? 'dim' : ''} ${admin ? 'admin' : ''}`} />
    </div>
  )
}

function Welcome({ onStart, onLogin, onAdmin, onCoach }) {
  const words = ['فراتر از', 'یک بازی']
  return (
    <div className="welcome-in">
      <div className="welcome-emblem"><Emblem size={84} /></div>
      <div className="welcome-copy">
        <h1>
          {words.map((w, i) => (
            <motion.span key={w} className={i === 1 ? 'hl' : ''} initial={{ opacity: 0, y: 40, rotate: 3 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 200, damping: 18 }}>{w}</motion.span>
          ))}
        </h1>
        <motion.p className="sub-line" initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} transition={{ delay: 0.7 }}>
          به سادگی زمین رزرو کنید، بازی بچینید و لذت ببرید.
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 0.85 }}>
          <b>مدرن‌ترین باشگاه</b> پدل استان البرز
        </motion.p>
      </div>
      <motion.div className="welcome-cta" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95 }}>
        <Button full variant="q" onClick={onStart}>شروع کنیم</Button>
        <Button full variant="glass" onClick={onLogin}>قبلاً عضو شده‌ام</Button>
        <div className="staff-links">
          <button className="admin-link" onClick={onAdmin}><Icon name="shield" size={16} /> ورود مدیر باشگاه</button>
          <i />
          <button className="admin-link" onClick={onCoach}><Icon name="coach" size={16} /> ورود مربی‌ها</button>
        </div>
      </motion.div>
    </div>
  )
}

// ورود مدیر یا مربی؛ نام کاربری و رمز هر مربی را مدیر در پرونده‌ی مربی می‌دهد و دسترسی را فعال می‌کند
function AdminLogin({ onBack, coach }) {
  const { loginAdmin, loginCoach, club, toast } = useStore()
  const [why, setWhy] = useState('')
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = () => {
    const fail = (msg) => { setErr(true); setWhy(msg); haptic([30, 30, 30]) }
    if (coach) {
      const c = (club.coaches || []).find((x) => x.login?.user && x.login.user.toLowerCase() === u.trim().toLowerCase())
      if (!c || c.login.pass !== p) return fail('نام کاربری یا رمز درست نیست')
      if (!c.login.on) return fail('دسترسی شما هنوز توسط مدیر فعال نشده است')
      setBusy(true); chime('success')
      setTimeout(() => { loginCoach(c.id); toast({ icon: '🎾', title: `خوش آمدید، ${c.name.split(' ')[0]}`, body: 'پنل مربی کوادرا' }) }, 700)
      return
    }
    if (u.trim().toLowerCase() !== 'admin' || p !== 'quadra') return fail('نام کاربری یا رمز درست نیست')
    setBusy(true); chime('success')
    setTimeout(() => { loginAdmin(); toast({ icon: '🛡', title: 'خوش آمدید، مدیر', body: 'پنل مدیریت کوادرا' }) }, 700)
  }
  return (
    <div className="admin-gate">
      <motion.div className="admin-card" animate={err ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} onAnimationComplete={() => setErr(false)}>
        <button className="icon-btn ghost" onClick={onBack} aria-label="بازگشت"><Icon name="back" /></button>
        <div className="admin-card-head">
          <QuadraMark size={44} tone="light" />
          <div><b>{coach ? 'پنل مربی' : 'پنل مدیریت'}</b><small>{coach ? 'نام کاربری و رمز را از مدیر باشگاه بگیرید' : 'فقط برای کارکنان کوادرا'}</small></div>
        </div>
        <label className="field dark"><Icon name="user" /><input dir="ltr" placeholder="نام کاربری" value={u} onChange={(e) => { setU(e.target.value); setWhy('') }} autoFocus /></label>
        <label className="field dark"><Icon name="lock" /><input dir="ltr" type="password" placeholder="رمز عبور" value={p} onChange={(e) => { setP(e.target.value); setWhy('') }} onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>
        {why && <p className="login-why">{why}</p>}
        <Button full variant="q" onClick={submit} disabled={!u || !p || busy}>{busy ? 'در حال ورود…' : 'ورود به پنل'}</Button>
        <Loading show={busy} text={coach ? 'ورود به پنل مربی…' : 'ورود به پنل مدیریت…'} />
        <p className="demo-hint">{coach ? <>نسخه‌ی نمایشی — نام کاربری <code>faraz</code>، رمز <code>1234</code></> : <>نسخه‌ی نمایشی — نام کاربری <code>admin</code>، رمز <code>quadra</code></>}</p>
      </motion.div>
    </div>
  )
}

function PhoneStep({ value, onChange, onNext, mode }) {
  const valid = /^09\d{9}$/.test(value)
  const pretty = value.replace(/^(\d{4})(\d{0,3})(\d{0,4}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '))
  return (
    <div className="step-body">
      <h2>{mode === 'login' ? 'خوش برگشتید 👋' : 'شماره موبایلتون؟'}</h2>
      <p className="muted">یک کد ۴ رقمی براتون پیامک می‌کنیم.</p>
      <label className={`field phone ${valid ? 'ok' : ''}`}>
        <Icon name="phone" />
        <input inputMode="numeric" autoFocus dir="ltr" placeholder="0912 345 6789" value={fa0(pretty)}
          onChange={(e) => onChange(toLatin(e.target.value).replace(/\D/g, '').slice(0, 11))}
          onKeyDown={(e) => e.key === 'Enter' && valid && onNext()} />
        <AnimatePresence>{valid && <motion.span className="field-ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Icon name="check" size={16} stroke={3} /></motion.span>}</AnimatePresence>
      </label>
      <Button full variant="q" disabled={!valid} onClick={onNext}>ارسال کد</Button>
      <button className="link center" onClick={() => { onChange('09120000000'); setTimeout(onNext, 150) }}>ورود سریع نمایشی</button>
    </div>
  )
}

function OtpStep({ phone, onNext }) {
  const [code, setCode] = useState(['', '', '', ''])
  const [auto, setAuto] = useState(false)
  const [sec, setSec] = useState(59)
  const refs = useRef([])
  useEffect(() => { refs.current[0]?.focus() }, [])
  useEffect(() => { const t = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t) }, [])
  // شبیه‌سازی دریافت خودکار پیامک (WebOTP)
  useEffect(() => {
    const t = setTimeout(() => {
      setAuto(true)
      '1234'.split('').forEach((d, i) => setTimeout(() => { haptic(6); setCode((c) => { const n = [...c]; n[i] = d; return n }) }, i * 140))
    }, 1500)
    return () => clearTimeout(t)
  }, [])
  const full = code.every(Boolean)
  useEffect(() => { if (full) { chime('success'); const t = setTimeout(onNext, 600); return () => clearTimeout(t) } }, [full])
  const put = (i, v) => {
    const d = toLatin(v).replace(/\D/g, '').slice(-1)
    setCode((c) => { const n = [...c]; n[i] = d; return n })
    if (d && i < 3) refs.current[i + 1]?.focus()
  }
  return (
    <div className="step-body">
      <h2>کد تأیید</h2>
      <p className="muted">به <b dir="ltr">{fa0(phone)}</b> ارسال شد</p>
      <div className="otp" dir="ltr">
        {code.map((d, i) => (
          <motion.input key={i} ref={(el) => (refs.current[i] = el)} inputMode="numeric" value={d ? fa0(d) : ''}
            className={d ? 'filled' : ''} animate={d ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.25 }}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus() }} />
        ))}
      </div>
      <AnimatePresence>
        {auto && <motion.p className="auto-sms" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>✨ کد از پیامک خودکار خوانده شد</motion.p>}
      </AnimatePresence>
      <p className="muted center">{sec > 0 ? `ارسال مجدد تا ${fa(sec)} ثانیه` : <button className="link">ارسال مجدد کد</button>}</p>
    </div>
  )
}

function NameStep({ form, set, onNext }) {
  const ok = form.name.trim().length >= 2
  return (
    <div className="step-body">
      <h2>چی صداتون کنیم؟</h2>
      <label className="field">
        <Icon name="user" />
        <input autoFocus placeholder="نام و نام خانوادگی" value={form.name} onChange={(e) => set({ name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && ok && onNext()} />
      </label>
      <Button full variant="q" disabled={!ok} onClick={onNext}>ادامه</Button>
    </div>
  )
}

// آزمون تعیین سطح — هر پاسخ ۰ تا ۳ امتیاز؛ مجموع ۰ تا ۳۰
const QUIZ = [
  { q: 'چند وقته به‌طور منظم پدل بازی می‌کنید؟', a: ['کمتر از ۳ ماه', '۳ ماه تا یک سال', 'یک تا سه سال', 'بیشتر از سه سال'] },
  { q: 'هفته‌ای چند بار بازی می‌کنید؟', a: ['کمتر از یک بار', 'یک بار', 'دو تا سه بار', 'چهار بار یا بیشتر'] },
  { q: 'سابقه‌ی تنیس یا اسکواش دارید؟', a: ['نه', 'تفریحی', 'باشگاهی و منظم', 'رقابتی'] },
  { q: 'سرویستون چطوره؟', a: ['هنوز زیاد خطا می‌زنم', 'وارد می‌کنم ولی ساده', 'با جهت و عمق کنترل‌شده', 'با اسپین و برای شروع حمله'] },
  { q: 'توپی که از دیوار پشتی برمی‌گرده رو چطور جواب می‌دید؟', a: ['معمولاً از دستم می‌ره', 'توپ‌های ساده رو برمی‌گردونم', 'بیشترشون رو کنترل‌شده می‌زنم', 'حتی دو دیوار و کرنر رو راحت می‌زنم'] },
  { q: 'پشت تور و والی؟', a: ['کمتر جلو می‌رم', 'والی ساده می‌زنم', 'والی با جهت و عمق', 'بلاک، دراپ و والی تهاجمی'] },
  { q: 'بندخا و ویبورا؟', a: ['نمی‌شناسم', 'می‌شناسم ولی نمی‌زنم', 'گاهی درست درمیاد', 'ابزار ثابت بازیمه'] },
  { q: 'اسمش (ضربه‌ی بالای سر)؟', a: ['نمی‌زنم', 'تخت و بی‌جهت', 'با قدرت و جهت', 'توپ رو از زمین بیرون می‌فرستم (x3 / x4)'] },
  { q: 'از لوب چطور استفاده می‌کنید؟', a: ['اتفاقی پیش میاد', 'برای فرار از فشار', 'عمدی برای گرفتن تور', 'دقیق روی ضعف حریف'] },
  { q: 'تجربه‌ی مسابقه دارید؟', a: ['نه', 'فقط دوستانه', 'تورنمنت باشگاهی', 'مسابقات رسمی / رنکینگ'] },
]
const CUTS = [27, 23, 19, 16, 13, 10, 7, 4] // حداقل امتیاز A، B+، B، B-، C+، C، C-، D+ (نتیجه حداکثر B)
const quizLevel = (ans) => {
  const score = ans.reduce((s, k) => s + k, 0)
  let i = CUTS.findIndex((c) => score >= c)
  if (i === -1) i = 8
  // آزمون حداکثر سطح B می‌دهد؛ B+ و A فقط با انتخاب مستقیم / ارزیابی مربی
  return LEVELS[Math.max(i, 2)].id
}

function LevelStep({ value, onChange, onNext }) {
  const [quiz, setQuiz] = useState(null)
  const [ans, setAns] = useState([])
  const answer = (k) => {
    haptic(8)
    const next = [...ans.slice(0, quiz), k]
    if (quiz < QUIZ.length - 1) { setAns(next); setQuiz(quiz + 1) } else {
      onChange(quizLevel(next)); setQuiz(null); setAns([]); chime('success')
    }
  }
  const prev = () => (quiz === 0 ? setQuiz(null) : setQuiz(quiz - 1))
  return (
    <div className="step-body">
      <h2>سطحتون چیه؟</h2>
      <p className="muted">برای مچ‌میکینگ — بعد از هر بازی دقیق‌تر می‌شه.</p>
      <AnimatePresence mode="wait">
        {quiz === null ? (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="quiz-cta" onClick={() => { setQuiz(0); setAns([]) }}>
              <Icon name="sparkle" /> مطمئن نیستم — با ۱۰ سؤال دقیق پیداش کن
            </button>
            <p className="quiz-note">نتیجه‌ی آزمون حداکثر سطح B است؛ سطح‌های B+ و A با ارزیابی مربی باشگاه تأیید می‌شوند.</p>
            <div className="level-list">
              {LEVELS.map((l) => (
                <motion.button key={l.id} className={`level-row ${value === l.id ? 'on' : ''}`} whileTap={{ scale: 0.98 }} onClick={() => { haptic(6); onChange(l.id) }}>
                  <LevelPill id={l.id} />
                  <div><b>{l.title}</b><small>{l.desc}</small></div>
                  {value === l.id && <motion.span layoutId="lvl-check" className="lvl-check"><Icon name="check" size={16} stroke={3} /></motion.span>}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key={'q' + quiz} className="quiz" initial={{ x: -40, opacity: 0, rotate: -2 }} animate={{ x: 0, opacity: 1, rotate: 0 }} exit={{ x: 40, opacity: 0, rotate: 2, pointerEvents: 'none' }}>
            <div className="quiz-top">
              <span className="quiz-n">{fa(quiz + 1)} / {fa(QUIZ.length)}</span>
              <button className="link" onClick={prev}>{quiz === 0 ? 'انصراف' : 'سؤال قبلی'}</button>
            </div>
            <div className="quiz-bar"><i style={{ width: `${((quiz + 1) / QUIZ.length) * 100}%` }} /></div>
            <h3>{QUIZ[quiz].q}</h3>
            {QUIZ[quiz].a.map((a, k) => (
              <motion.button key={a} className={`quiz-a ${ans[quiz] === k ? 'on' : ''}`} whileTap={{ scale: 0.97 }} onClick={() => answer(k)}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.05 }}>{a}</motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {quiz === null && <Button full variant="q" disabled={!value} onClick={onNext}>ادامه</Button>}
    </div>
  )
}

function SideStep({ value, onChange, onNext }) {
  return (
    <div className="step-body">
      <h2>کدام سمت زمین بازی می‌کنید؟</h2>
      <p className="muted">برای پیدا کردن یار مناسب — بعداً هم قابل تغییر است.</p>
      <div className="side-pick">
        {SIDES.map((x) => (
          <button key={x.id} className={`side-opt ${value === x.id ? 'on' : ''}`} onClick={() => { haptic(6); onChange(x.id) }}>
            <svg viewBox="0 0 40 56" className={`side-ic ${x.id}`} aria-hidden="true">
              <rect x="2" y="2" width="36" height="52" rx="4" /><line x1="2" y1="28" x2="38" y2="28" /><line x1="20" y1="28" x2="20" y2="54" />
              <rect className="hl-r" x="20" y="28" width="18" height="26" /><rect className="hl-l" x="2" y="28" width="18" height="26" />
            </svg>
            <div className="grow"><b>{x.name}</b><small>{x.desc}</small></div>
          </button>
        ))}
      </div>
      <Button full variant="q" disabled={!value} onClick={onNext}>تموم شد!</Button>
    </div>
  )
}

function Done({ form, onEnter }) {
  return (
    <div className="done">
      <motion.div className="done-badge" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
        <LevelPill id={form.level} big />
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>{form.name}، آماده‌اید!</motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 0.45 }}>سطح شروع: {form.level}، رتبه‌ی باشگاه: تازه‌وارد</motion.p>
      <motion.div className="xp-pop" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: 'spring' }}>+۲۰ XP، ۵۰۰ هزار تومان اعتبار هدیه</motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} style={{ width: '100%' }}>
        <Button full variant="q" onClick={onEnter}>بریم!</Button>
      </motion.div>
    </div>
  )
}
