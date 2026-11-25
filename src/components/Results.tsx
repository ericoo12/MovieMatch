import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMovies, fetchVotes } from '../lib/api'
import { computeResults, type RankedMovie, type Results as ResultData } from '../lib/results'
import { posterUrl } from '../lib/tmdb'
import type { Participant, Room } from '../lib/types'
import ProviderBadges from './ProviderBadges'
import { Button, ErrorText, Spinner } from './ui'

type Props = { room: Room; participants: Participant[] }

function MovieRow({ item, voterCount }: { item: RankedMovie; voterCount: number }) {
  const poster = posterUrl(item.movie.poster_path, 'w342')
  return (
    <li className="flex gap-3 rounded-2xl bg-slate-800 p-3">
      {poster && <img src={poster} alt="" className="h-28 w-[4.7rem] shrink-0 rounded-lg object-cover" />}
      <div className="flex flex-col gap-1.5">
        <h3 className="leading-tight font-semibold">{item.movie.title}</h3>
        {item.movie.genres.length > 0 && <p className="text-xs text-slate-400">{item.movie.genres.join(' · ')}</p>}
        <p className="text-sm text-rose-300">
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

  useEffect(() => {
    Promise.all([fetchMovies(room.id), fetchVotes(room.id)])
      .then(([movies, votes]) => setResult(computeResults(movies, participants, votes)))
      .catch((e: Error) => setError(e.message))
  }, [room.id, participants])

  if (error) return <ErrorText>{error}</ErrorText>
  if (!result) return <Spinner label="Räknar röster…" />

  const { matches, top, voterCount } = result

  return (
    <div className="flex flex-col gap-5">
      {matches.length > 0 ? (
        <>
          <div className="text-center">
            <p className="text-4xl">🎉</p>
            <h1 className="text-3xl font-bold">{matches.length === 1 ? 'Det blev en match!' : `${matches.length} matcher!`}</h1>
            <p className="text-slate-400">Alla sa ja till {matches.length === 1 ? 'den här filmen' : 'de här filmerna'}.</p>
          </div>
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
