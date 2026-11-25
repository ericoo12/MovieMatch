import { useState } from 'react'
import { removeSaved, saveMovie } from '../lib/api'
import { useProfile } from '../lib/profile'
import type { MovieInfo, MovieList } from '../lib/types'

const LABELS: Record<MovieList, { off: string; on: string }> = {
  favorite: { off: '♡ Favorit', on: '♥ Favorit' },
  watchlist: { off: '+ Watchlist', on: '✓ Watchlist' },
  seen: { off: 'Sett?', on: '✓ Sett' },
}

/** Små knappar för att spara en film i sina listor. Bara för Premium. */
export default function SaveButtons({
  movie,
  lists = ['favorite', 'watchlist', 'seen'],
}: {
  movie: MovieInfo
  lists?: MovieList[]
}) {
  const { isPremium } = useProfile()
  const [saved, setSaved] = useState<Set<MovieList>>(new Set())
  if (!isPremium) return null

  async function toggle(list: MovieList) {
    const on = saved.has(list)
    setSaved((prev) => {
      const next = new Set(prev)
      if (on) next.delete(list)
      else next.add(list)
      return next
    })
    try {
      if (on) await removeSaved(list, movie.tmdb_id)
      else await saveMovie(list, movie)
    } catch {
      setSaved((prev) => {
        const next = new Set(prev)
        if (on) next.add(list)
        else next.delete(list)
        return next
      })
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {lists.map((list) => {
        const on = saved.has(list)
        return (
          <button
            key={list}
            onClick={() => toggle(list)}
            aria-pressed={on}
            className={`rounded-full px-2.5 py-1 text-xs transition ${
              on
                ? 'bg-amber-400/20 text-amber-200 hover:bg-amber-400/30'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600 active:bg-slate-500'
            }`}
          >
            {on ? LABELS[list].on : LABELS[list].off}
          </button>
        )
      })}
    </div>
  )
}
