import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from './lib/profile'
import { isConfigured } from './lib/supabase'
import About from './pages/About'
import GroupPage from './pages/GroupPage'
import Groups from './pages/Groups'
import Home from './pages/Home'
import JoinGroup from './pages/JoinGroup'
import Pricing from './pages/Pricing'
import ProfilePage from './pages/ProfilePage'
import RoomPage from './pages/RoomPage'
import Solo from './pages/Solo'

const NAV = [
  { to: '/', label: 'Hem', icon: '⌂', end: true },
  { to: '/solo', label: 'Solo', icon: '◎', end: false },
  { to: '/grupper', label: 'Grupper', icon: '☰', end: false },
  { to: '/profil', label: 'Profil', icon: '◉', end: false },
]

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const aboutOpen = location.pathname === '/om'
  const { isPremium } = useProfile()
  // I ett filmrum döljs menyn så att swipandet får hela skärmen.
  const inRoom = location.pathname.startsWith('/r/')

  // Ett nytt klick på "Om" stänger sidan och tar dig tillbaka dit du var.
  function toggleAbout() {
    if (!aboutOpen) navigate('/om')
    else if (location.key !== 'default') navigate(-1)
    else navigate('/')
  }

  return (
    <div className={`mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-4 ${inRoom ? 'pb-6' : 'pb-24'}`}>
      <header className="mb-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          Movie<span className="text-rose-400">Match</span>
        </Link>
        <div className="flex items-center gap-1">
          {isPremium ? (
            <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
              Premium
            </span>
          ) : (
            <Link
              to="/premium"
              className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900 hover:bg-amber-300 active:bg-amber-500"
            >
              Premium
            </Link>
          )}
          <button
            onClick={toggleAbout}
            aria-expanded={aboutOpen}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 active:bg-slate-700"
          >
            {aboutOpen ? 'Stäng' : 'Om'}
          </button>
        </div>
      </header>

      {!isConfigured && (
        <p className="mb-4 rounded-lg bg-amber-500/15 p-3 text-sm text-amber-200">
          Supabase är inte konfigurerat. Kopiera <code>.env.example</code> till <code>.env.local</code> och fyll i
          nycklarna.
        </p>
      )}

      <main className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/r/:code" element={<RoomPage />} />
          <Route path="/om" element={<About />} />
          <Route path="/premium" element={<Pricing />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/solo" element={<Solo />} />
          <Route path="/grupper" element={<Groups />} />
          <Route path="/grupper/:id" element={<GroupPage />} />
          <Route path="/g/:code" element={<JoinGroup />} />
          <Route path="*" element={<p>Sidan finns inte.</p>} />
        </Routes>
      </main>

      <footer className="mt-6 text-center text-xs text-slate-500">
        Filmdata från TMDB · Streamingdata från JustWatch
      </footer>

      {!inRoom && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <ul className="mx-auto grid max-w-md grid-cols-4">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-2.5 text-xs transition hover:text-slate-200 ${
                      isActive ? 'text-rose-400' : 'text-slate-500'
                    }`
                  }
                >
                  <span aria-hidden className="text-lg leading-none">
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
