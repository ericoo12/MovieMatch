import { useEffect, useState } from 'react'
import { fetchLists } from '../lib/api'
import { logoUrl } from '../lib/tmdb'
import type { Provider } from '../lib/types'

type Props = {
  selected: Set<number>
  onToggle: (id: number) => void
  /** Låst när deltagaren har tryckt Klar. */
  locked: boolean
}

/** Rutnät med streamingtjänster. Själva sparandet sker med knappen längst ner i lobbyn. */
export default function ServicePicker({ selected, onToggle, locked }: Props) {
  const [providers, setProviders] = useState<Provider[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLists()
      .then((l) => setProviders(l.providers))
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">Vilka tjänster har du?</h2>
      {!providers && !error && <p className="text-sm text-slate-400">Hämtar tjänster…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        {providers?.map((p) => {
          const on = selected.has(p.id)
          const logo = logoUrl(p.logo_path)
          return (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              disabled={locked}
              aria-pressed={on}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition disabled:opacity-60 ${
                on
                  ? 'border-rose-400 bg-rose-500/15 enabled:hover:bg-rose-500/25 enabled:active:bg-rose-500/35'
                  : 'border-slate-700 bg-slate-800 enabled:hover:bg-slate-700 enabled:active:bg-slate-600'
              }`}
            >
              {logo && <img src={logo} alt="" className="h-10 w-10 rounded-lg" />}
              <span className="line-clamp-2 text-center">{p.name}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
