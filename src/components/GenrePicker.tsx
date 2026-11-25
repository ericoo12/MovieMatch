import { useEffect, useState } from 'react'
import { fetchLists, setGenres } from '../lib/api'
import type { Genre, Room } from '../lib/types'

type Props = { room: Room; isHost: boolean; onError: (message: string) => void }

/** Rumsledaren väljer en eller flera genrer. Inget val = alla genrer. Övriga ser valet. */
export default function GenrePicker({ room, isHost, onError }: Props) {
  const [genres, setGenreList] = useState<Genre[]>([])

  useEffect(() => {
    fetchLists()
      .then((l) => setGenreList(l.genres))
      .catch((e: Error) => onError(e.message))
  }, [onError])

  const selected = new Set(room.genre_ids)
  const names = genres.filter((g) => selected.has(g.id)).map((g) => g.name)

  if (!isHost) {
    return (
      <p className="text-sm text-slate-400">
        Genrer: <span className="text-slate-200">{names.length > 0 ? names.join(', ') : 'Alla'}</span>
      </p>
    )
  }

  function toggle(id: number) {
    const next = selected.has(id) ? room.genre_ids.filter((g) => g !== id) : [...room.genre_ids, id]
    setGenres(room.id, next).catch((e: Error) => onError(e.message))
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Genrer</h2>
        {selected.size > 0 ? (
          <button
            className="text-sm text-rose-300 hover:text-rose-200"
            onClick={() => setGenres(room.id, []).catch((e: Error) => onError(e.message))}
          >
            Visa alla
          </button>
        ) : (
          <span className="text-sm text-slate-400">Alla genrer</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {genres.map((g) => {
          const on = selected.has(g.id)
          return (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                on
                  ? 'border-rose-400 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30 active:bg-rose-500/40'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 active:bg-slate-600'
              }`}
            >
              {g.name}
            </button>
          )
        })}
      </div>
    </section>
  )
}
