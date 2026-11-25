import { useParams } from 'react-router-dom'
import Lobby from '../components/Lobby'
import Results from '../components/Results'
import Voting from '../components/Voting'
import { ErrorText, Spinner } from '../components/ui'
import { useRoom } from '../lib/useRoom'

export default function RoomPage() {
  const { code = '' } = useParams()
  const { room, participants, me, error, loading } = useRoom(code.toUpperCase())

  if (loading) return <Spinner label="Går med i rummet…" />
  if (error || !room || !me) return <ErrorText>{error ?? 'Kunde inte öppna rummet.'}</ErrorText>

  switch (room.status) {
    case 'lobby':
      return <Lobby room={room} participants={participants} me={me} />
    case 'voting':
      return <Voting room={room} participants={participants} me={me} />
    case 'finished':
      return <Results room={room} participants={participants} />
  }
}
