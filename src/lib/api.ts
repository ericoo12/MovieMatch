import { ensureSession, supabase } from './supabase'
import type { Participant, Provider, Room, RoomMovie, Vote } from './types'

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

export const createRoom = () => rpc<string>('create_room')
export const joinRoom = (code: string) => rpc<string>('join_room', { p_code: code })
export const setServices = (roomId: string, providers: number[]) =>
  rpc<void>('set_services', { p_room: roomId, p_providers: providers })
export const setMovieCount = (roomId: string, count: number) =>
  rpc<void>('set_movie_count', { p_room: roomId, p_count: count })
export const castVote = (roomId: string, tmdbId: number, liked: boolean) =>
  rpc<void>('cast_vote', { p_room: roomId, p_tmdb_id: tmdbId, p_liked: liked })
export const finishRoom = (roomId: string) => rpc<void>('finish_room', { p_room: roomId })
export const startRoom = (roomId: string) => invoke<{ ok: true; count: number }>('start-room', { roomId })

let providerCache: Provider[] | null = null
export async function fetchProviders(): Promise<Provider[]> {
  if (providerCache) return providerCache
  const { providers } = await invoke<{ providers: Provider[] }>('providers')
  providerCache = providers
  return providers
}

export async function fetchRoom(roomId: string): Promise<Room> {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single()
  if (error) throw new Error(error.message)
  return data as Room
}

export async function fetchParticipants(roomId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at')
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

export async function fetchMovies(roomId: string): Promise<RoomMovie[]> {
  const { data, error } = await supabase.from('room_movies').select('*').eq('room_id', roomId).order('position')
  if (error) throw new Error(error.message)
  return data as RoomMovie[]
}

/** Egna röster under röstningen, alla röster efter avslut (styrs av RLS). */
export async function fetchVotes(roomId: string): Promise<Vote[]> {
  const { data, error } = await supabase.from('votes').select('*').eq('room_id', roomId)
  if (error) throw new Error(error.message)
  return data as Vote[]
}
