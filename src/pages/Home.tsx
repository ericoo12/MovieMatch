import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AdSlot from '../components/AdSlot'
import { Button, ErrorText } from '../components/ui'
import { createRoom } from '../lib/api'

export default function Home() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onCreate() {
    setBusy(true)
    setError(null)
    try {
      const newCode = await createRoom()
      navigate(`/r/${newCode}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  function onJoin(e: FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length === 6) navigate(`/r/${clean}`)
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-8">
      <div>
        <h1 className="text-3xl font-bold">Välj film tillsammans</h1>
        <p className="mt-2 text-slate-400">
          Skapa ett filmrum, bjud in gruppen och swipa ja eller nej. Appen visar vad ni alla gillar.
        </p>
      </div>

      <Button onClick={onCreate} disabled={busy}>
        {busy ? 'Skapar rum…' : 'Skapa filmrum'}
      </Button>

      <form onSubmit={onJoin} className="flex flex-col gap-3">
        <label htmlFor="code" className="text-sm text-slate-400">
          Har du en kod?
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="T.ex. K7PX2M"
          className="rounded-xl bg-slate-800 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] uppercase placeholder:text-base placeholder:tracking-normal"
        />
        <Button type="submit" variant="secondary" disabled={code.trim().length !== 6}>
          Gå med
        </Button>
      </form>

      <ErrorText>{error}</ErrorText>

      <AdSlot size="card" />
    </div>
  )
}
