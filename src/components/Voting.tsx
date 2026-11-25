import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { castVote, fetchMovies, fetchVotes, finishRoom } from '../lib/api'
import type { Participant, Room, RoomMovie } from '../lib/types'
import MovieCard from './MovieCard'
import { Button, ErrorText, Spinner } from './ui'

type Props = { room: Room; participants: Participant[]; me: Participant }

export default function Voting({ room, participants, me }: Props) {
  const [movies, setMovies] = useState<RoomMovie[] | null>(null)
  const [voted, setVoted] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchMovies(room.id, room.round), fetchVotes(room.id)])
      .then(([m, v]) => {
        setMovies(m)
        setVoted(new Set(v.filter((x) => x.participant_id === me.id).map((x) => x.tmdb_id)))
      })
      .catch((e: Error) => setError(e.message))
  }, [room.id, room.round, me.id])

  const remaining = useMemo(() => (movies ?? []).filter((m) => !voted.has(m.tmdb_id)), [movies, voted])
  const current = remaining.at(0)
  const finishedCount = participants.filter((p) => p.finished_voting_at).length

  async function vote(liked: boolean) {
    if (!current) return
    const id = current.tmdb_id
    setVoted((prev) => new Set(prev).add(id))
    try {
      await castVote(room.id, id, liked)
    } catch (e) {
      setVoted((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setError((e as Error).message)
    }
  }

  if (!movies && !error) return <Spinner label="Hämtar filmer…" />

  if (!current) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-2xl font-bold">Du är klar!</p>
        <p className="text-slate-400">
          {finishedCount} av {participants.length} har röstat klart. Resultatet visas när alla är klara.
        </p>
        <ErrorText>{error}</ErrorText>
        {me.is_host && (
          <Button variant="secondary" onClick={() => finishRoom(room.id).catch((e: Error) => setError(e.message))}>
            Avsluta och visa resultat nu
          </Button>
        )}
      </div>
    )
  }

  const position = (movies?.length ?? 0) - remaining.length + 1

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex justify-between text-sm text-slate-400">
        <span>
          Film {position} av {movies?.length}
        </span>
        <span>
          {finishedCount} av {participants.length} klara
        </span>
      </div>

      <div className="relative min-h-[60dvh] flex-1">
        <AnimatePresence>
          <MovieCard key={current.tmdb_id} movie={current} onVote={vote} />
        </AnimatePresence>
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => vote(false)} aria-label="Nej">
          ✕ Nej
        </Button>
        <Button onClick={() => vote(true)} aria-label="Ja">
          ♥ Ja
        </Button>
      </div>
    </div>
  )
}
