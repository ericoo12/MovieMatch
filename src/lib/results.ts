import type { Participant, RoomMovie, Vote } from './types'

export type RankedMovie = {
  movie: RoomMovie
  likes: number
}

export type Results = {
  /** Filmer som alla räknade deltagare har sagt ja till. */
  matches: RankedMovie[]
  /** Filmer med flest ja, används när det inte finns någon match. */
  top: RankedMovie[]
  /** Antal deltagare vars röster räknas. */
  voterCount: number
}

const TOP_LIMIT = 5

/**
 * Räknar fram resultatet enligt planens regler:
 * 1. Match = alla räknade deltagare har röstat ja.
 * 2. Ingen match -> topplista med flest ja (max 5), filmer utan ja visas inte.
 * 3. Lika antal ja -> högst TMDB-popularitet först.
 * 4. Avslutat i förtid -> bara deltagare som röstat på alla filmer räknas.
 *    Har ingen hunnit klart räknas alla som röstat på minst en film.
 */
export function computeResults(movies: RoomMovie[], participants: Participant[], votes: Vote[]): Results {
  const finished = participants.filter((p) => p.finished_voting_at !== null)
  const voters =
    finished.length > 0
      ? finished
      : participants.filter((p) => votes.some((v) => v.participant_id === p.id))
  const voterIds = new Set(voters.map((p) => p.id))

  const ranked: RankedMovie[] = movies.map((movie) => ({
    movie,
    likes: votes.filter((v) => v.tmdb_id === movie.tmdb_id && v.liked && voterIds.has(v.participant_id)).length,
  }))

  ranked.sort((a, b) => b.likes - a.likes || b.movie.popularity - a.movie.popularity)

  const voterCount = voterIds.size
  const matches = voterCount > 0 ? ranked.filter((r) => r.likes === voterCount) : []
  const top = ranked.filter((r) => r.likes > 0).slice(0, TOP_LIMIT)

  return { matches, top, voterCount }
}
