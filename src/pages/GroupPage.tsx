import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MovieListItem from '../components/MovieListItem'
import Toast from '../components/Toast'
import { Button, ErrorText, Spinner } from '../components/ui'
import {
  addGroupMovie,
  createRoom,
  fetchGroup,
  fetchGroupMovies,
  groupActiveRoom,
  leaveGroup,
  removeGroupMovie,
} from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Group, GroupList, GroupMovie } from '../lib/types'

const TABS: { list: GroupList; label: string; empty: string }[] = [
  { list: 'match', label: 'Matchningar', empty: 'Starta ett filmrum från gruppen så sparas era matchningar här.' },
  { list: 'watchlist', label: 'Watchlist', empty: 'Lägg matchningar på gruppens watchlist för en annan kväll.' },
  { list: 'seen', label: 'Sett', empty: 'Markera filmer ni har sett tillsammans.' },
]

export default function GroupPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState(0)
  const [movies, setMovies] = useState<GroupMovie[]>([])
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const [tab, setTab] = useState<GroupList>('match')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [{ group, memberCount }, list, room] = await Promise.all([
      fetchGroup(id),
      fetchGroupMovies(id),
      groupActiveRoom(id),
    ])
    setGroup(group)
    setMembers(memberCount)
    setMovies(list)
    setActiveRoom(room)
  }, [id])

  useEffect(() => {
    reload().catch((e: Error) => setError(e.message))
    const channel = supabase
      .channel(`group-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_movies', filter: `group_id=eq.${id}` },
        () => void reload().catch(() => undefined),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [id, reload])

  if (error && !group) return <ErrorText>{error}</ErrorText>
  if (!group) return <Spinner />

  async function startRoom() {
    setBusy(true)
    try {
      navigate(`/r/${await createRoom(id)}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  async function copyInvite() {
    const link = `${window.location.origin}/g/${group!.code}`
    try {
      await navigator.clipboard.writeText(link)
      setToast('Länken har kopierats')
    } catch {
      setToast(link)
    }
    setTimeout(() => setToast(null), 2500)
  }

  async function move(item: GroupMovie, to: GroupList) {
    await addGroupMovie(id, to, { ...item.movie, tmdb_id: item.tmdb_id }).catch((e: Error) => setError(e.message))
    if (item.list === 'watchlist' && to === 'seen') await removeGroupMovie(id, 'watchlist', item.tmdb_id)
    await reload()
  }

  async function remove(item: GroupMovie) {
    await removeGroupMovie(id, item.list, item.tmdb_id).catch((e: Error) => setError(e.message))
    await reload()
  }

  async function leave() {
    await leaveGroup(id)
    navigate('/grupper')
  }

  const visible = movies.filter((m) => m.list === tab)
  const current = TABS.find((t) => t.list === tab)!

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-slate-800 p-4">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="text-sm text-slate-400">
          {members} {members === 1 ? 'medlem' : 'medlemmar'} · kod <span className="font-mono">{group.code}</span>
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {activeRoom ? (
            <Button onClick={() => navigate(`/r/${activeRoom}`)}>Gå med i pågående filmrum</Button>
          ) : (
            <Button onClick={startRoom} disabled={busy}>
              {busy ? 'Skapar rum…' : 'Starta filmrum med gruppen'}
            </Button>
          )}
          <Button variant="muted" onClick={copyInvite}>
            Bjud in till gruppen
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1">
          {TABS.map((t) => (
            <button
              key={t.list}
              onClick={() => setTab(t.list)}
              aria-pressed={tab === t.list}
              className={`rounded-lg py-2 text-sm transition ${
                tab === t.list ? 'bg-slate-600 font-semibold' : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              {t.label} ({movies.filter((m) => m.list === t.list).length})
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{current.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((item) => (
              <MovieListItem key={`${item.list}-${item.tmdb_id}`} movie={{ ...item.movie, tmdb_id: item.tmdb_id }}>
                <div className="flex flex-wrap gap-3 text-xs">
                  {item.list !== 'watchlist' && item.list !== 'seen' && (
                    <button className="text-sky-300 hover:text-sky-200" onClick={() => move(item, 'watchlist')}>
                      + Watchlist
                    </button>
                  )}
                  {item.list !== 'seen' && (
                    <button className="text-emerald-300 hover:text-emerald-200" onClick={() => move(item, 'seen')}>
                      ✓ Vi har sett den
                    </button>
                  )}
                  <button className="text-slate-400 hover:text-slate-200" onClick={() => remove(item)}>
                    Ta bort
                  </button>
                </div>
              </MovieListItem>
            ))}
          </ul>
        )}
      </section>

      <ErrorText>{error}</ErrorText>
      <button className="text-sm text-slate-500 hover:text-red-300" onClick={leave}>
        Lämna gruppen
      </button>
      <Toast message={toast} />
    </div>
  )
}
