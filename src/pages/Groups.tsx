import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ErrorText, Spinner } from '../components/ui'
import { createGroup, fetchGroups, joinGroup } from '../lib/api'
import { useProfile } from '../lib/profile'
import type { Group } from '../lib/types'

export default function Groups() {
  const navigate = useNavigate()
  const { isPremium } = useProfile()
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchGroups()
      .then(setGroups)
      .catch((e: Error) => setError(e.message))
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    try {
      navigate(`/grupper/${await createGroup(name)}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault()
    try {
      navigate(`/grupper/${await joinGroup(code)}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Dina filmgrupper</h1>
        <p className="text-slate-400">Spara gänget, era matchningar, sedda filmer och en gemensam watchlist.</p>
      </div>

      {!groups && !error && <Spinner />}
      {groups && groups.length > 0 && (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                to={`/grupper/${g.id}`}
                className="flex items-center justify-between rounded-xl bg-slate-800 p-4 hover:bg-slate-700 active:bg-slate-600"
              >
                <span className="font-semibold">{g.name}</span>
                <span className="text-slate-400">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {groups && groups.length === 0 && <p className="text-sm text-slate-400">Du är inte med i någon grupp än.</p>}

      {isPremium ? (
        <form onSubmit={create} className="flex flex-col gap-2 rounded-2xl bg-slate-800 p-4">
          <label htmlFor="group-name" className="font-semibold">
            Ny grupp
          </label>
          <input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="T.ex. Fredagsgänget"
            className="rounded-xl bg-slate-900 px-4 py-3"
          />
          <Button type="submit" disabled={!name.trim()}>
            Skapa grupp
          </Button>
        </form>
      ) : (
        <Link to="/premium" className="rounded-2xl border border-amber-400/40 p-4 text-sm hover:bg-amber-400/5">
          <span className="font-semibold text-amber-200">Skapa egna grupper med Premium.</span>{' '}
          <span className="text-slate-400">Du kan fortfarande gå med i vänners grupper med en kod.</span>
        </Link>
      )}

      <form onSubmit={join} className="flex flex-col gap-2 rounded-2xl bg-slate-800 p-4">
        <label htmlFor="group-code" className="font-semibold">
          Gå med i en grupp
        </label>
        <input
          id="group-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="Gruppkod"
          className="rounded-xl bg-slate-900 px-4 py-3 font-mono tracking-widest uppercase"
        />
        <Button type="submit" variant="muted" disabled={code.trim().length !== 6}>
          Gå med
        </Button>
      </form>

      <ErrorText>{error}</ErrorText>
    </div>
  )
}
