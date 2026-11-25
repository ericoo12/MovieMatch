import { useEffect, useState } from 'react'
import { fetchLists } from '../lib/api'
import type { Genre } from '../lib/types'

/** Valfria genrer som chips. Inget val = alla genrer. */
export default function GenreChips({ selected, onChange }: { selected: number[]; onChange: (ids: number[]) => void }) {
  const [genres, setGenres] = useState<Genre[]>([])

  useEffect(() => {
    fetchLists()
      .then((l) => setGenres(l.genres))
      .catch(() => undefined)
  }, [])

  const on = new Set(selected)
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <button
        onClick={() => onChange([])}
        className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
          on.size === 0 ? 'border-rose-400 bg-rose-500/20' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
        }`}
      >
        Alla
      </button>
      {genres.map((g) => (
        <button
          key={g.id}
          onClick={() => onChange(on.has(g.id) ? selected.filter((x) => x !== g.id) : [...selected, g.id])}
          aria-pressed={on.has(g.id)}
          className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
            on.has(g.id) ? 'border-rose-400 bg-rose-500/20' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
          }`}
        >
          {g.name}
        </button>
      ))}
    </div>
  )
}
