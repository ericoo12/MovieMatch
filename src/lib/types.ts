export type RoomStatus = 'lobby' | 'voting' | 'finished'

export type Room = {
  id: string
  code: string
  host_id: string
  status: RoomStatus
  movie_count: number
  region: string
  /** TMDB-genre-id:n som rumsledaren valt. Tom lista = alla genrer. */
  genre_ids: number[]
  /** Film som slumpats fram bland matcherna, syns för alla. */
  picked_tmdb_id: number | null
  /** Omgång 1, 2, 3 … Varje ny omgång får filmer som inte visats förut. */
  round: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  expires_at: string
  /** Skapat av en premiumanvändare: reklamfritt för alla i rummet. */
  is_premium: boolean
  /** Rummet startades från en grupp; matchningar sparas där. */
  group_id: string | null
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

export type Genre = {
  id: number
  name: string
}

export type RoomMovie = {
  room_id: string
  round: number
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

/** Det som visas på ett filmkort. RoomMovie och sparade filmer har samma fält. */
export type MovieInfo = {
  tmdb_id: number
  title: string
  poster_path: string | null
  genres: string[]
  providers: Provider[]
  release_year: number | null
}

export type Plan = 'free' | 'premium'

export type Profile = {
  user_id: string
  plan: Plan
  premium_since: string | null
  saved_provider_ids: number[]
}

export type MovieList = 'favorite' | 'watchlist' | 'seen'

export type SavedMovie = {
  list: MovieList
  tmdb_id: number
  movie: Omit<MovieInfo, 'tmdb_id'>
  created_at: string
}

export type Group = {
  id: string
  name: string
  code: string
  owner_id: string
  created_at: string
}

export type GroupList = 'match' | 'seen' | 'watchlist'

export type GroupMovie = {
  group_id: string
  list: GroupList
  tmdb_id: number
  movie: Omit<MovieInfo, 'tmdb_id'>
  created_at: string
}
