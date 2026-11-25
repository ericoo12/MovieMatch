import { Link, Route, Routes } from 'react-router-dom'
import { isConfigured } from './lib/supabase'
import About from './pages/About'
import Home from './pages/Home'
import RoomPage from './pages/RoomPage'

export default function App() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-4 pb-6">
      <header className="mb-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          Movie<span className="text-rose-400">Match</span>
        </Link>
        <Link to="/om" className="text-sm text-slate-400">
          Om
        </Link>
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
          <Route path="*" element={<p>Sidan finns inte.</p>} />
        </Routes>
      </main>

      <footer className="mt-6 text-center text-xs text-slate-500">
        Filmdata från TMDB · Streamingdata från JustWatch
      </footer>
    </div>
  )
}
