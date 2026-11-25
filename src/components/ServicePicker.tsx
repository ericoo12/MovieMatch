import { useEffect, useState } from 'react'
import { fetchLists, fetchMyServices, setServices } from '../lib/api'
import { logoUrl } from '../lib/tmdb'
import type { Participant, Provider } from '../lib/types'
import { Button, ErrorText } from './ui'

export default function ServicePicker({ roomId, me }: { roomId: string; me: Participant }) {
  const [providers, setProviders] = useState<Provider[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState(!me.services_done)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLists()
      .then((l) => setProviders(l.providers)).catch((e: Error) => setError(e.message))
    fetchMyServices(me.id)
      .then((ids) => setSelected(new Set(ids)))
      .catch(() => undefined)
  }, [me.id])

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await setServices(roomId, [...selected])
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-slate-800 p-3 text-sm">
        <span>Du har valt {selected.size} tjänster</span>
        <button className="text-rose-300 hover:text-rose-200" onClick={() => setEditing(true)}>
          Ändra
        </button>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">Vilka tjänster har du?</h2>
      {!providers && !error && <p className="text-sm text-slate-400">Hämtar tjänster…</p>}
      <div className="grid grid-cols-3 gap-2">
        {providers?.map((p) => {
          const on = selected.has(p.id)
          const logo = logoUrl(p.logo_path)
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              aria-pressed={on}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition ${
                on ? 'border-rose-400 bg-rose-500/15 hover:bg-rose-500/25' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
              }`}
            >
              {logo && <img src={logo} alt="" className="h-10 w-10 rounded-lg" />}
              <span className="line-clamp-2 text-center">{p.name}</span>
            </button>
          )
        })}
      </div>
      <ErrorText>{error}</ErrorText>
      <Button onClick={save} disabled={busy || selected.size === 0}>
        {busy ? 'Sparar…' : 'Klar'}
      </Button>
    </section>
  )
}
