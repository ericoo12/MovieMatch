import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMovies, fetchVotes, pickMovie } from '../lib/api'
import { computeResults, type RankedMovie, type Results as ResultData } from '../lib/results'
import { posterUrl } from '../lib/tmdb'
import type { Participant, Room } from '../lib/types'
import ProviderBadges from './ProviderBadges'
import { Button, ErrorText, Spinner } from './ui'

type Props = { room: Room; participants: Participant[] }

function MovieRow({ item, voterCount, highlight }: { item: RankedMovie; voterCount: number; highlight?: boolean }) {
  const poster = posterUrl(item.movie.poster_path, 'w342')
  return (
    <li
      className={`flex gap-3 rounded-2xl p-3 ${highlight ? 'bg-emerald-500/15 ring-2 ring-emerald-400' : 'bg-slate-800'}`}
    >
      {poster && <img src={poster} alt="" className="h-28 w-[4.7rem] shrink-0 rounded-lg object-cover" />}
      <div className="flex flex-col gap-1.5">
        <h3 className="leading-tight font-semibold">{item.movie.title}</h3>
        {item.movie.genres.length > 0 && <p className="text-xs text-slate-400">{item.movie.genres.join(' · ')}</p>}
        <p className="text-sm font-medium text-emerald-400">
          {item.likes} av {voterCount} gillade
        </p>
        <ProviderBadges providers={item.movie.providers} />
      </div>
    </li>
  )
}

export default function Results({ room, participants }: Props) {
  const navigate = useNavigate()
  const [result, setResult] = useState<ResultData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    Promise.all([fetchMovies(room.id), fetchVotes(room.id)])
      .then(([movies, votes]) => setResult(computeResults(movies, participants, votes)))
      .catch((e: Error) => setError(e.message))
  }, [room.id, participants])

  if (error && !result) return <ErrorText>{error}</ErrorText>
  if (!result) return <Spinner label="Räknar röster…" />

  const { matches, top, voterCount } = result
  // Den slumpade filmen sparas i rummet, så alla i gruppen ser samma val.
  const picked = matches.find((m) => m.movie.tmdb_id === room.picked_tmdb_id) ?? null

  async function pickRandom() {
    const options = matches.filter((m) => m.movie.tmdb_id !== room.picked_tmdb_id)
    const choice = options[Math.floor(Math.random() * options.length)]
    if (!choice) return
    setPicking(true)
    setError(null)
    try {
      await pickMovie(room.id, choice.movie.tmdb_id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {matches.length > 0 ? (
        <>
          <div className="text-center">
            <h1 className="text-3xl font-bold">
              {matches.length === 1 ? 'Det blev en match!' : `${matches.length} matcher!`}
            </h1>
            <p className="text-slate-400">
              Alla sa ja till {matches.length === 1 ? 'den här filmen' : 'de här filmerna'}.
            </p>
          </div>

          {matches.length > 1 && (
            <div className="flex flex-col gap-3">
              {picked && (
                <motion.div
                  key={picked.movie.tmdb_id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col gap-2"
                >
                  <p className="text-center text-sm font-semibold text-emerald-300">Slumpen valde</p>
                  <ul>
                    <MovieRow item={picked} voterCount={voterCount} highlight />
                  </ul>
                </motion.div>
              )}
              <Button onClick={pickRandom} disabled={picking}>
                {picking ? 'Slumpar…' : picked ? 'Slumpa igen' : 'Slumpa en film'}
              </Button>
              <ErrorText>{error}</ErrorText>
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {matches.map((m) => (
              <MovieRow key={m.movie.tmdb_id} item={m} voterCount={voterCount} />
            ))}
          </ul>
        </>
      ) : top.length > 0 ? (
        <>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Ingen enhällig match</h1>
            <p className="text-slate-400">Här är gruppens mest gillade filmer.</p>
          </div>
          <ol className="flex flex-col gap-3">
            {top.map((m) => (
              <MovieRow key={m.movie.tmdb_id} item={m} voterCount={voterCount} />
            ))}
          </ol>
        </>
      ) : (
        <div className="text-center">
          <h1 className="text-2xl font-bold">Ingen favorit den här gången</h1>
          <p className="text-slate-400">Ingen film fick ett ja. Testa en ny omgång med nya filmer.</p>
        </div>
      )}

      <Button variant="secondary" onClick={() => navigate('/')}>
        Ny omgång
      </Button>
      <p className="text-center text-xs text-slate-500">Streamingdata från JustWatch</p>
    </div>
  )
}
