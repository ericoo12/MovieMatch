import { describe, expect, it } from 'vitest'
import { computeResults } from './results'
import type { Participant, RoomMovie, Vote } from './types'

const movie = (tmdb_id: number, popularity = 10): RoomMovie => ({
  room_id: 'r',
  round: 1,
  position: tmdb_id,
  tmdb_id,
  title: `Film ${tmdb_id}`,
  poster_path: null,
  genres: [],
  providers: [],
  popularity,
  release_year: null,
})

const person = (id: string, finished = true): Participant => ({
  id,
  room_id: 'r',
  user_id: `u-${id}`,
  is_host: id === 'a',
  services_done: true,
  finished_voting_at: finished ? '2026-11-25T10:00:00Z' : null,
  joined_at: '2026-11-25T09:00:00Z',
})

const vote = (participant_id: string, tmdb_id: number, liked: boolean): Vote => ({
  room_id: 'r',
  participant_id,
  tmdb_id,
  liked,
})

describe('computeResults', () => {
  it('ger match när alla har röstat ja', () => {
    const movies = [movie(1), movie(2)]
    const people = [person('a'), person('b')]
    const votes = [vote('a', 1, true), vote('b', 1, true), vote('a', 2, true), vote('b', 2, false)]

    const r = computeResults(movies, people, votes)

    expect(r.matches.map((m) => m.movie.tmdb_id)).toEqual([1])
    expect(r.voterCount).toBe(2)
  })

  it('visar topplista med flest ja när ingen match finns', () => {
    const movies = [movie(1), movie(2), movie(3)]
    const people = [person('a'), person('b'), person('c')]
    const votes = [
      vote('a', 1, true), vote('b', 1, true), vote('c', 1, false),
      vote('a', 2, true), vote('b', 2, false), vote('c', 2, false),
      vote('a', 3, false), vote('b', 3, false), vote('c', 3, false),
    ]

    const r = computeResults(movies, people, votes)

    expect(r.matches).toEqual([])
    expect(r.top.map((m) => [m.movie.tmdb_id, m.likes])).toEqual([[1, 2], [2, 1]])
  })

  it('sorterar lika antal ja efter popularitet', () => {
    const movies = [movie(1, 5), movie(2, 50)]
    const people = [person('a'), person('b')]
    const votes = [vote('a', 1, true), vote('b', 1, false), vote('a', 2, false), vote('b', 2, true)]

    const r = computeResults(movies, people, votes)

    expect(r.top.map((m) => m.movie.tmdb_id)).toEqual([2, 1])
  })

  it('räknar bara de som röstat klart om rummet avslutas i förtid', () => {
    const movies = [movie(1), movie(2)]
    const people = [person('a'), person('b'), person('c', false)]
    const votes = [vote('a', 1, true), vote('b', 1, true), vote('c', 1, false), vote('a', 2, false), vote('b', 2, false)]

    const r = computeResults(movies, people, votes)

    expect(r.voterCount).toBe(2)
    expect(r.matches.map((m) => m.movie.tmdb_id)).toEqual([1])
  })

  it('ger varken match eller topplista när ingen sagt ja', () => {
    const movies = [movie(1)]
    const people = [person('a'), person('b')]
    const votes = [vote('a', 1, false), vote('b', 1, false)]

    const r = computeResults(movies, people, votes)

    expect(r.matches).toEqual([])
    expect(r.top).toEqual([])
  })

  it('visar alla matcher när flera filmer får ja från alla', () => {
    const movies = [movie(1, 1), movie(2, 2)]
    const people = [person('a')]
    const votes = [vote('a', 1, true), vote('a', 2, true)]

    const r = computeResults(movies, people, votes)

    expect(r.matches.map((m) => m.movie.tmdb_id)).toEqual([2, 1])
  })
})
