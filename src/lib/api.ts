import { ensureSession, supabase } from './supabase'
import type {
  Genre,
  Group,
  GroupList,
  GroupMovie,
  MovieInfo,
  MovieList,
  Participant,
  Plan,
  Profile,
  Provider,
  Room,
  RoomMovie,
  SavedMovie,
  Vote,
} from './types'

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  await ensureSession()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

async function invoke<T>(fn: string, body?: Record<string, unknown>): Promise<T> {
  await ensureSession()
  const { data, error } = await supabase.functions.invoke(fn, { body: body ?? {} })
  if (error) {
    // Edge-funktionen svarar med { error } i kroppen, försök läsa den.
    const context = (error as { context?: Response }).context
    const message = context ? ((await context.json().catch(() => null)) as { error?: string } | null)?.error : null
    throw new Error(message ?? error.message)
  }
  return data as T
}

export const createRoom = (groupId?: string) => rpc<string>('create_room', groupId ? { p_group: groupId } : {})
export const joinRoom = (code: string) => rpc<string>('join_room', { p_code: code })
export const setServices = (roomId: string, providers: number[]) =>
  rpc<void>('set_services', { p_room: roomId, p_providers: providers })
export const reopenServices = (roomId: string) => rpc<void>('reopen_services', { p_room: roomId })
export const setMovieCount = (roomId: string, count: number) =>
  rpc<void>('set_movie_count', { p_room: roomId, p_count: count })
export const castVote = (roomId: string, tmdbId: number, liked: boolean) =>
  rpc<void>('cast_vote', { p_room: roomId, p_tmdb_id: tmdbId, p_liked: liked })
export const setGenres = (roomId: string, genreIds: number[]) =>
  rpc<void>('set_genres', { p_room: roomId, p_genre_ids: genreIds })
export const pickMovie = (roomId: string, tmdbId: number) =>
  rpc<void>('pick_movie', { p_room: roomId, p_tmdb_id: tmdbId })
export const finishRoom = (roomId: string) => rpc<void>('finish_room', { p_room: roomId })
/** Startar röstningen, eller en ny omgång med nya filmer om rummet redan är klart. */
export const startRoom = (roomId: string) => invoke<{ ok: true; count: number }>('start-room', { roomId })

type Lists = { providers: Provider[]; genres: Genre[] }
let listCache: Promise<Lists> | null = null

/** Streamingtjänster och genrer för lobbyn. Hämtas en gång per sidladdning. */
export function fetchLists(): Promise<Lists> {
  listCache ??= invoke<Lists>('providers').catch((e) => {
    listCache = null
    throw e
  })
  return listCache
}

export async function fetchRoom(roomId: string): Promise<Room> {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single()
  if (error) throw new Error(error.message)
  return data as Room
}

export async function fetchParticipants(roomId: string): Promise<Participant[]> {
  const { data, error } = await supabase.from('participants').select('*').eq('room_id', roomId).order('joined_at')
  if (error) throw new Error(error.message)
  return data as Participant[]
}

export async function fetchMyServices(participantId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('participant_services')
    .select('provider_id')
    .eq('participant_id', participantId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => r.provider_id as number)
}

/** Filmerna i en viss omgång av rummet. */
export async function fetchMovies(roomId: string, round: number): Promise<RoomMovie[]> {
  const { data, error } = await supabase
    .from('room_movies')
    .select('*')
    .eq('room_id', roomId)
    .eq('round', round)
    .order('position')
  if (error) throw new Error(error.message)
  return data as RoomMovie[]
}

/** Egna röster under röstningen, alla röster efter avslut (styrs av RLS). */
export async function fetchVotes(roomId: string): Promise<Vote[]> {
  const { data, error } = await supabase.from('votes').select('*').eq('room_id', roomId)
  if (error) throw new Error(error.message)
  return data as Vote[]
}

// ---------------------------------------------------------------------------
// Profil och Premium
// ---------------------------------------------------------------------------

export const fetchProfile = () => rpc<Profile>('my_profile')
/** TESTLÄGE: byter plan utan betalning. */
export const setPlan = (plan: Plan) => rpc<Profile>('set_plan', { p_plan: plan })
export const saveMyProviders = (providers: number[]) => rpc<void>('save_my_providers', { p_providers: providers })

/** Sparar titel, affisch m.m. så att listorna kan visas utan TMDB-anrop. */
function snapshot(m: MovieInfo): Omit<MovieInfo, 'tmdb_id'> {
  return {
    title: m.title,
    overview: m.overview ?? null,
    poster_path: m.poster_path,
    genres: m.genres,
    providers: m.providers,
    release_year: m.release_year,
  }
}

export async function fetchSaved(): Promise<SavedMovie[]> {
  await ensureSession()
  const { data, error } = await supabase.from('saved_movies').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as SavedMovie[]
}

export async function saveMovie(list: MovieList, movie: MovieInfo): Promise<void> {
  const user = await ensureSession()
  const { error } = await supabase
    .from('saved_movies')
    .upsert({ user_id: user, list, tmdb_id: movie.tmdb_id, movie: snapshot(movie) })
  if (error) throw new Error(error.message)
}

export async function removeSaved(list: MovieList, tmdbId: number): Promise<void> {
  const { error } = await supabase.from('saved_movies').delete().eq('list', list).eq('tmdb_id', tmdbId)
  if (error) throw new Error(error.message)
}

export const fetchSoloMovies = (body: { providers?: number[]; genreIds?: number[]; excludeIds?: number[] }) =>
  invoke<{ movies: MovieInfo[] }>('solo-movies', body).then((r) => r.movies)

// ---------------------------------------------------------------------------
// Grupper
// ---------------------------------------------------------------------------

export async function fetchGroups(): Promise<Group[]> {
  await ensureSession()
  const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Group[]
}

export async function fetchGroup(groupId: string): Promise<{ group: Group; memberCount: number }> {
  await ensureSession()
  const [{ data: group, error }, { count }] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', groupId),
  ])
  if (error) throw new Error(error.message)
  return { group: group as Group, memberCount: count ?? 0 }
}

export const createGroup = (name: string) => rpc<string>('create_group', { p_name: name })
export const joinGroup = (code: string) => rpc<string>('join_group', { p_code: code })
export const leaveGroup = (groupId: string) => rpc<void>('leave_group', { p_group: groupId })
export const groupActiveRoom = (groupId: string) => rpc<string | null>('group_active_room', { p_group: groupId })
export const saveGroupMatches = (roomId: string) => rpc<number>('save_group_matches', { p_room: roomId })

export async function fetchGroupMovies(groupId: string): Promise<GroupMovie[]> {
  const { data, error } = await supabase
    .from('group_movies')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as GroupMovie[]
}

export async function addGroupMovie(groupId: string, list: GroupList, movie: MovieInfo): Promise<void> {
  const user = await ensureSession()
  const { error } = await supabase
    .from('group_movies')
    .upsert({ group_id: groupId, list, tmdb_id: movie.tmdb_id, movie: snapshot(movie), added_by: user })
  if (error) throw new Error(error.message)
}

export async function removeGroupMovie(groupId: string, list: GroupList, tmdbId: number): Promise<void> {
  const { error } = await supabase
    .from('group_movies')
    .delete()
    .eq('group_id', groupId)
    .eq('list', list)
    .eq('tmdb_id', tmdbId)
  if (error) throw new Error(error.message)
}
