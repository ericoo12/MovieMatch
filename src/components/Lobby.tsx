import { useCallback, useState } from 'react'
import { setMovieCount, startRoom } from '../lib/api'
import type { Participant, Room } from '../lib/types'
import GenrePicker from './GenrePicker'
import ServicePicker from './ServicePicker'
import Toast from './Toast'
import { Button, ErrorText } from './ui'

type Props = { room: Room; participants: Participant[]; me: Participant }

export default function Lobby({ room, participants, me }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const showError = useCallback((message: string) => setError(message), [])
  const link = `${window.location.origin}/r/${room.code}`
  const readyCount = participants.filter((p) => p.services_done).length

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setToast('Länken har kopierats')
    } catch {
      // Vissa webbläsare tillåter inte urklipp, visa då länken så att den kan kopieras för hand.
      setToast(link)
    }
    setTimeout(() => setToast(null), 2500)
  }

  async function changeCount(delta: number) {
    const next = Math.min(30, Math.max(5, room.movie_count + delta))
    if (next !== room.movie_count) await setMovieCount(room.id, next).catch((e: Error) => setError(e.message))
  }

  async function start() {
    setBusy(true)
    setError(null)
    try {
      await startRoom(room.id)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-slate-800 p-4 text-center">
        <p className="text-sm text-slate-400">Rumskod</p>
        <p className="font-mono text-4xl font-bold tracking-[0.3em]">{room.code}</p>
        <Button variant="muted" className="mt-3" onClick={copyLink}>
          Bjud in med länk
        </Button>
      </section>

      <ServicePicker roomId={room.id} me={me} />

      <GenrePicker room={room} isHost={me.is_host} onError={showError} />

      <section>
        <h2 className="mb-2 font-semibold">
          Deltagare ({readyCount} av {participants.length} klara)
        </h2>
        <ul className="flex flex-col gap-1.5">
          {participants.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
              <span>
                Deltagare {i + 1}
                {p.id === me.id && ' (du)'}
                {p.is_host && ' · rumsledare'}
              </span>
              <span className={p.services_done ? 'text-emerald-400' : 'text-slate-500'}>
                {p.services_done ? 'Klar' : 'Väljer tjänster'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {me.is_host ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-800 p-3">
            <span className="text-sm">Antal filmer att rösta på</span>
            <div className="flex items-center gap-3">
              <button
                className="h-9 w-9 rounded-full bg-slate-700 text-lg hover:bg-slate-600 active:bg-slate-500"
                onClick={() => changeCount(-1)}
                aria-label="Färre filmer"
              >
                −
              </button>
              <span className="w-6 text-center font-semibold">{room.movie_count}</span>
              <button
                className="h-9 w-9 rounded-full bg-slate-700 text-lg hover:bg-slate-600 active:bg-slate-500"
                onClick={() => changeCount(1)}
                aria-label="Fler filmer"
              >
                +
              </button>
            </div>
          </div>
          {readyCount < participants.length && readyCount > 0 && (
            <p className="text-xs text-slate-400">
              Deltagare som inte valt tjänster när du startar tas bort från rummet.
            </p>
          )}
          <ErrorText>{error}</ErrorText>
          <Button onClick={start} disabled={busy || readyCount === 0}>
            {busy ? 'Hämtar filmer…' : 'Starta röstningen'}
          </Button>
        </section>
      ) : (
        <p className="text-center text-sm text-slate-400">
          Rumsledaren väljer antal filmer ({room.movie_count}) och startar när alla är klara.
        </p>
      )}
      {!me.is_host && <ErrorText>{error}</ErrorText>}

      <Toast message={toast} />
    </div>
  )
}
