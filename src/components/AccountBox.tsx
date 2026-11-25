import { useState, type FormEvent } from 'react'
import { ensureSession, supabase } from '../lib/supabase'
import { useProfile } from '../lib/profile'
import { Button, ErrorText } from './ui'

/**
 * Konto med e-post och lösenord. Utan konto lever profilen bara i den här webbläsaren.
 * "Skapa konto" gör om den anonyma sessionen till ett riktigt konto, så Premium och listor följer med.
 */
export default function AccountBox() {
  const { email, refresh } = useProfile()
  const [mode, setMode] = useState<'create' | 'login'>('create')
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'create') {
        const { data, error } = await supabase.auth.updateUser({ email: form.email, password: form.password })
        if (error) throw error
        setInfo(
          data.user?.email ? 'Kontot är skapat.' : 'Kolla din e-post och bekräfta adressen för att slutföra kontot.',
        )
      } else {
        const { error } = await supabase.auth.signInWithPassword(form)
        if (error) throw error
      }
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    await ensureSession()
    await refresh()
  }

  if (email) {
    return (
      <section className="flex items-center justify-between rounded-2xl bg-slate-800 p-4 text-sm">
        <span>
          Inloggad som <span className="font-semibold">{email}</span>
        </span>
        <button className="text-rose-300 hover:text-rose-200" onClick={logout}>
          Logga ut
        </button>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-slate-800 p-4">
      <h2 className="font-semibold">{mode === 'create' ? 'Spara ditt konto' : 'Logga in'}</h2>
      <p className="text-sm text-slate-400">
        {mode === 'create'
          ? 'Utan konto finns din profil bara i den här webbläsaren. Med konto når du Premium, grupper och listor från alla enheter.'
          : 'Logga in för att hämta din profil från en annan enhet.'}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="E-post"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-xl bg-slate-900 px-4 py-3"
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          placeholder="Lösenord (minst 6 tecken)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="rounded-xl bg-slate-900 px-4 py-3"
        />
        <ErrorText>{error}</ErrorText>
        {info && <p className="rounded-lg bg-emerald-500/15 p-3 text-sm text-emerald-200">{info}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? 'Vänta…' : mode === 'create' ? 'Skapa konto' : 'Logga in'}
        </Button>
      </form>
      <button
        className="text-sm text-slate-400 hover:text-slate-200"
        onClick={() => setMode(mode === 'create' ? 'login' : 'create')}
      >
        {mode === 'create' ? 'Har du redan ett konto? Logga in' : 'Inget konto? Skapa ett'}
      </button>
    </section>
  )
}
