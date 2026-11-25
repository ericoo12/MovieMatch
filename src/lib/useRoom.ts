import { useCallback, useEffect, useState } from 'react'
import { fetchParticipants, fetchRoom, joinRoom } from './api'
import { ensureSession, supabase } from './supabase'
import type { Participant, Room } from './types'

type State = {
  room: Room | null
  participants: Participant[]
  me: Participant | null
  error: string | null
  loading: boolean
}

/** Går med i rummet via koden och håller rum + deltagare uppdaterade i realtid. */
export function useRoom(code: string) {
  const [state, setState] = useState<State>({ room: null, participants: [], me: null, error: null, loading: true })
  const [roomId, setRoomId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const refresh = useCallback(async (id: string, uid: string) => {
    const [room, participants] = await Promise.all([fetchRoom(id), fetchParticipants(id)])
    setState({
      room,
      participants,
      me: participants.find((p) => p.user_id === uid) ?? null,
      error: null,
      loading: false,
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const uid = await ensureSession()
        const id = await joinRoom(code)
        if (cancelled) return
        setUserId(uid)
        setRoomId(id)
        await refresh(id, uid)
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, error: (e as Error).message, loading: false }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, refresh])

  useEffect(() => {
    if (!roomId || !userId) return
    const reload = () => void refresh(roomId, userId).catch(() => undefined)
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, reload)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        reload,
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [roomId, userId, refresh])

  return {
    ...state,
    reload: () => (roomId && userId ? refresh(roomId, userId) : Promise.resolve()),
  }
}
