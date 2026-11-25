import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AccountBox from '../components/AccountBox'
import MovieListItem from '../components/MovieListItem'
import ServicePicker from '../components/ServicePicker'
import { Button, ErrorText } from '../components/ui'
import { fetchSaved, removeSaved, saveMovie, saveMyProviders } from '../lib/api'
import { useProfile } from '../lib/profile'
import type { MovieList, SavedMovie } from '../lib/types'

const TABS: { list: MovieList; label: string; empty: string }[] = [
  { list: 'favorite', label: 'Favoriter', empty: 'Tryck ♡ Favorit på en film för att spara den här.' },
  { list: 'watchlist', label: 'Watchlist', empty: 'Lägg till filmer från Solo Swipe eller resultatsidan.' },
  { list: 'seen', label: 'Historik', empty: 'Markera filmer som sedda så samlas de här.' },
]

export default function ProfilePage() {
  const { profile, isPremium, changePlan, refresh } = useProfile()
  const [params] = useSearchParams()
  const [saved, setSaved] = useState<SavedMovie[]>([])
  const [tab, setTab] = useState<MovieList>('favorite')
  const [services, setServices] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isPremium)
      fetchSaved()
        .then(setSaved)
        .catch((e: Error) => setError(e.message))
  }, [isPremium])

  useEffect(() => {
    setServices(new Set(profile?.saved_provider_ids ?? []))
  }, [profile?.saved_provider_ids])

  function toggleService(id: number) {
    setServices((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function storeServices() {
    setError(null)
    try {
      await saveMyProviders([...services])
      await refresh()
      setMessage('Dina tjänster är sparade och fylls i automatiskt i nya rum.')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(item: SavedMovie) {
    setSaved((prev) => prev.filter((s) => !(s.list === item.list && s.tmdb_id === item.tmdb_id)))
    await removeSaved(item.list, item.tmdb_id).catch((e: Error) => setError(e.message))
  }

  async function markSeen(item: SavedMovie) {
    const movie = { ...item.movie, tmdb_id: item.tmdb_id }
    await saveMovie('seen', movie).catch((e: Error) => setError(e.message))
    await removeSaved('watchlist', item.tmdb_id).catch(() => undefined)
    setSaved(await fetchSaved())
  }

  const visible = saved.filter((s) => s.list === tab)
  const current = TABS.find((t) => t.list === tab)!

  return (
    <div className="flex flex-col gap-5">
      {params.get('valkommen') && isPremium && (
        <p className="rounded-xl bg-amber-400/15 p-3 text-center text-sm font-semibold text-amber-200">
          Välkommen till Premium! Inga annonser, och alla funktioner är upplåsta.
        </p>
      )}

      <section className="flex items-center justify-between rounded-2xl bg-slate-800 p-4">
        <div>
          <p className="text-sm text-slate-400">Din plan</p>
          <p className={`text-xl font-bold ${isPremium ? 'text-amber-300' : ''}`}>
            {isPremium ? 'MovieMatch Premium' : 'MovieMatch Free'}
          </p>
        </div>
        {isPremium ? (
          <button
            className="text-xs text-slate-400 hover:text-slate-200"
            onClick={() => changePlan('free').catch((e: Error) => setError(e.message))}
            title="Testläge: byter tillbaka till Free"
          >
            Avsluta (testläge)
          </button>
        ) : (
          <Link
            to="/premium"
            className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 active:bg-amber-500"
          >
            Uppgradera
          </Link>
        )}
      </section>

      <AccountBox />

      <ErrorText>{error}</ErrorText>
      {message && <p className="rounded-lg bg-emerald-500/15 p-3 text-sm text-emerald-200">{message}</p>}

      {isPremium ? (
        <>
          <section className="flex flex-col gap-3">
            <ServicePicker selected={services} onToggle={toggleService} locked={false} />
            <Button variant="muted" onClick={storeServices} disabled={services.size === 0}>
              Spara mina tjänster
            </Button>
          </section>

          <section className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1">
              {TABS.map((t) => (
                <button
                  key={t.list}
                  onClick={() => setTab(t.list)}
                  aria-pressed={tab === t.list}
                  className={`rounded-lg py-2 text-sm transition ${
                    tab === t.list ? 'bg-slate-600 font-semibold' : 'text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {t.label} ({saved.filter((s) => s.list === t.list).length})
                </button>
              ))}
            </div>
            {visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{current.empty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {visible.map((item) => (
                  <MovieListItem key={`${item.list}-${item.tmdb_id}`} movie={{ ...item.movie, tmdb_id: item.tmdb_id }}>
                    <div className="flex gap-3 text-xs">
                      {item.list === 'watchlist' && (
                        <button className="text-emerald-300 hover:text-emerald-200" onClick={() => markSeen(item)}>
                          ✓ Har sett den
                        </button>
                      )}
                      <button className="text-slate-400 hover:text-slate-200" onClick={() => remove(item)}>
                        Ta bort
                      </button>
                    </div>
                  </MovieListItem>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section className="flex flex-col gap-2 rounded-2xl border border-amber-400/40 p-4 text-sm">
          <p className="font-semibold text-amber-200">Med Premium får du också</p>
          <ul className="list-inside list-disc text-slate-300">
            <li>Sparade streamingtjänster</li>
            <li>Favoriter, watchlist och filmhistorik</li>
            <li>Solo Swipe och permanenta grupper</li>
          </ul>
        </section>
      )}
    </div>
  )
}
