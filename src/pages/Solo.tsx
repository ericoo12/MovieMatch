import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import GenreChips from '../components/GenreChips'
import MovieCard from '../components/MovieCard'
import PremiumGate from '../components/PremiumGate'
import ServicePicker from '../components/ServicePicker'
import { Button, ErrorText, Spinner } from '../components/ui'
import { fetchSoloMovies, saveMovie, saveMyProviders } from '../lib/api'
import { useProfile } from '../lib/profile'
import type { MovieInfo } from '../lib/types'

/** Solo Swipe: höger = watchlist, vänster = hoppa över. */
export default function Solo() {
  const { profile, isPremium, refresh } = useProfile()
  const [queue, setQueue] = useState<MovieInfo[]>([])
  const [genres, setGenres] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(0)
  const [services, setServices] = useState<Set<number>>(new Set())
  const shown = useRef<Set<number>>(new Set())

  const hasServices = (profile?.saved_provider_ids.length ?? 0) > 0

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const movies = await fetchSoloMovies({ genreIds: genres, excludeIds: [...shown.current] })
        movies.forEach((m) => shown.current.add(m.tmdb_id))
        setQueue((q) => (reset ? movies : [...q, ...movies]))
        if (movies.length === 0) setError('Inga fler filmer just nu. Testa andra genrer.')
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [genres],
  )

  useEffect(() => {
    if (isPremium && hasServices) void load(true)
  }, [isPremium, hasServices, load])

  // Hämta fler i förväg när kön börjar ta slut.
  useEffect(() => {
    if (isPremium && hasServices && !loading && queue.length === 3) void load(false)
  }, [queue.length, isPremium, hasServices, loading, load])

  if (!profile) return <Spinner />
  if (!isPremium) {
    return (
      <PremiumGate
        title="Solo Swipe"
        text="Upptäck filmer på egen hand. Swipa höger så hamnar filmen på din watchlist."
      />
    )
  }

  if (!hasServices) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Solo Swipe</h1>
        <p className="text-slate-400">Välj dina streamingtjänster först. De sparas till nästa gång.</p>
        <ServicePicker
          selected={services}
          onToggle={(id) =>
            setServices((prev) => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          locked={false}
        />
        <ErrorText>{error}</ErrorText>
        <Button
          disabled={services.size === 0}
          onClick={() =>
            saveMyProviders([...services])
              .then(refresh)
              .catch((e: Error) => setError(e.message))
          }
        >
          Spara och börja swipa
        </Button>
      </div>
    )
  }

  const current = queue.at(0)

  async function vote(liked: boolean) {
    if (!current) return
    setQueue((q) => q.slice(1))
    if (liked) {
      setAdded((n) => n + 1)
      await saveMovie('watchlist', current).catch((e: Error) => setError(e.message))
    }
  }

  async function seen() {
    if (!current) return
    setQueue((q) => q.slice(1))
    await saveMovie('seen', current).catch((e: Error) => setError(e.message))
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Solo Swipe</h1>
        <span className="text-sm text-slate-400">{added} på watchlist</span>
      </div>
      <GenreChips
        selected={genres}
        onChange={(g) => {
          setGenres(g)
          setQueue([])
        }}
      />

      <div className="relative min-h-[55dvh] flex-1">
        {current ? (
          <AnimatePresence>
            <MovieCard key={current.tmdb_id} movie={current} onVote={vote} />
          </AnimatePresence>
        ) : loading ? (
          <Spinner label="Letar filmer…" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
            <p>Slut på filmer för stunden.</p>
            <Button variant="secondary" onClick={() => load(true)}>
              Hämta fler
            </Button>
          </div>
        )}
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={() => vote(false)} disabled={!current}>
          ✕ Nej
        </Button>
        <Button variant="muted" onClick={seen} disabled={!current}>
          Sett
        </Button>
        <Button onClick={() => vote(true)} disabled={!current}>
          + Watchlist
        </Button>
      </div>
    </div>
  )
}
