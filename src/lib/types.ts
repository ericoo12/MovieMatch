export type RoomStatus = 'lobby' | 'voting' | 'finished'

export type Room = {
  id: string
  code: string
  host_id: string
  status: RoomStatus
  movie_count: number
  region: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  expires_at: string
}

export type Participant = {
  id: string
  room_id: string
  user_id: string
  is_host: boolean
  services_done: boolean
  finished_voting_at: string | null
  joined_at: string
}

export type Provider = {
  id: number
  name: string
  logo_path: string | null
}

export type RoomMovie = {
  room_id: string
  position: number
  tmdb_id: number
  title: string
  poster_path: string | null
  genres: string[]
  providers: Provider[]
  popularity: number
  release_year: number | null
}

export type Vote = {
  room_id: string
  participant_id: string
  tmdb_id: number
  liked: boolean
}
