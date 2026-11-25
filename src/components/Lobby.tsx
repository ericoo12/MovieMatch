import { useCallback, useEffect, useState } from 'react'
import { fetchMyServices, reopenServices, setMovieCount, setServices, startRoom } from '../lib/api'
import type { Participant, Room } from '../lib/types'
import GenrePicker from './GenrePicker'
import ServicePicker from './ServicePicker'
import Toast from './Toast'
import { Button, ErrorText } from './ui'

type Props = { room: Room; participants: Participant[]; me: Participant }

export default function Lobby({ room, participants, me }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const showError = useCallback((message: string) => setError(message), [])
  const link = `${window.location.origin}/r/${room.code}`

  // Rumsledaren behöver ingen Klar-knapp: hens tjänster sparas när röstningen startas.
  const others = participants.filter((p) => !p.is_host)
  const waitingFor = others.filter((p) => !p.services_done).length
  const locked = !me.is_host && me.services_done

  useEffect(() => {
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

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const markDone = () => run(() => setServices(room.id, [...selected]))
  const start = () =>
    run(async () => {
      await setServices(room.id, [...selected])
      await startRoom(room.id)
    })

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-slate-800 p-4 text-center">
        <p className="text-sm text-slate-400">Rumskod</p>
        <p className="font-mono text-4xl font-bold tracking-[0.3em]">{room.code}</p>
        <Button variant="muted" className="mt-3" onClick={copyLink}>
          Bjud in med länk
        </Button>
      </section>

      <ServicePicker selected={selected} onToggle={toggle} locked={locked} />

      <GenrePicker room={room} isHost={me.is_host} onError={showError} />

      {me.is_host ? (
        <section className="flex items-center justify-between rounded-xl bg-slate-800 p-3">
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
        </section>
      ) : (
        <p className="text-sm text-slate-400">
          Antal filmer: <span className="text-slate-200">{room.movie_count}</span>
        </p>
      )}

      <section>
        <h2 className="mb-2 font-semibold">
          Deltagare ({others.length - waitingFor} av {others.length} klara)
        </h2>
        <ul className="flex flex-col gap-1.5">
          {participants.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
              <span>
                Deltagare {i + 1}
                {p.id === me.id && ' (du)'}
              </span>
              {p.is_host ? (
                <span className="text-slate-400">Rumsledare</span>
              ) : (
                <span className={p.services_done ? 'text-emerald-400' : 'text-slate-500'}>
                  {p.services_done ? 'Klar' : 'Väljer tjänster'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <ErrorText>{error}</ErrorText>
        {me.is_host ? (
          <Button onClick={start} disabled={busy || waitingFor > 0 || selected.size === 0}>
            {busy
              ? 'Hämtar filmer…'
              : selected.size === 0
                ? 'Välj dina tjänster först'
                : waitingFor > 0
                  ? `Väntar på ${waitingFor} deltagare`
                  : 'Starta röstningen'}
          </Button>
        ) : locked ? (
          <>
            <p className="text-center text-sm text-slate-400">Du är klar. Rumsledaren startar när alla är klara.</p>
            {/* Att ändra tjänster släpper Klar tills man trycker igen, så rumsledaren inte startar för tidigt. */}
            <Button variant="secondary" onClick={() => run(() => reopenServices(room.id))} disabled={busy}>
              Ändra mina val
            </Button>
          </>
        ) : (
          <Button onClick={markDone} disabled={busy || selected.size === 0}>
            {busy ? 'Sparar…' : selected.size === 0 ? 'Välj minst en tjänst' : 'Klar'}
          </Button>
        )}
      </section>

      <Toast message={toast} />
    </div>
  )
}
