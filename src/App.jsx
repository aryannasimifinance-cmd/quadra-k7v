import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useStore } from './store'
import { Toasts } from './components/ui'
import { Loading, Sting } from './components/Logo'
import Gate from './screens/Gate'
import Main from './screens/player/Main'

const Admin = lazy(() => import('./screens/admin/Admin'))
const Coach = lazy(() => import('./screens/coach/Coach'))

export default function App() {
  const { session } = useStore()
  const [sting, setSting] = useState(() => { try { return !sessionStorage.getItem('quadra-sting') } catch { return true } })
  useEffect(() => { if (!sting) return; try { sessionStorage.setItem('quadra-sting', '1') } catch { /* */ } const t = setTimeout(() => setSting(false), 3400); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const admin = session?.role === 'admin'
  const coach = session?.role === 'coach'

  return (
    <>
      {admin && !sting ? (
        <Suspense fallback={<Loading text="بارگذاری پنل مدیریت…" />}><Admin /></Suspense>
      ) : (
        <div className="stage">
          <div className="stage-bg" style={{ backgroundImage: 'url(./img/welcome-night.jpg)' }} />
          <div className="app">
            {!sting && (coach
              ? <Suspense fallback={<Loading text="بارگذاری پنل مربی…" />}><Coach key="c" /></Suspense>
              : session?.role === 'player' ? <Main key="m" /> : <Gate key="g" />)}
            <div id="portal" />
          </div>
        </div>
      )}
      <AnimatePresence>{sting && <Sting key="s" onSkip={() => setSting(false)} />}</AnimatePresence>
      <Toasts />
      {admin && <div id="portal" />}
    </>
  )
}
