// POST /functions/v1/start-room { roomId }
// Rumsledaren startar röstningen. Funktionen slår ihop gruppens tjänster,
// hämtar filmer från TMDB som finns på minst en av dem och sparar N filmer.
// När ett rum är klart startar samma anrop en ny omgång med filmer som inte visats förut.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { findMovies } from '../_shared/pick.ts'

const PAGES = 6
const MAX_PAGES = 15

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { roomId } = await req.json()
    if (!roomId) return json({ error: 'roomId saknas' }, 400)

    // Vem anropar? Kontrollera sessionen med anroparens JWT.
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Inte inloggad' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: room, error: roomError } = await admin.from('rooms').select('*').eq('id', roomId).single()
    if (roomError || !room) return json({ error: 'Rummet finns inte' }, 404)
    if (room.host_id !== userData.user.id) return json({ error: 'Bara rumsledaren kan starta' }, 403)
    if (room.status === 'voting') return json({ error: 'Röstningen har redan startat' }, 409)
    const newRound = room.status === 'finished'

    // Gruppens samlade tjänster (unionen).
    const { data: participants } = await admin
      .from('participants')
      .select('id, services_done, participant_services(provider_id)')
      .eq('room_id', roomId)
    const all = participants ?? []
    const notReady = all.filter((p) => !p.services_done).length
    if (all.length === 0 || notReady > 0) {
      return json({ error: `Väntar på att ${notReady} deltagare ska bli klara` }, 400)
    }

    const groupProviders = new Set<number>()
    for (const p of all) for (const s of p.participant_services ?? []) groupProviders.add(s.provider_id)

    // Filmer som redan visats i rummet (tidigare omgångar) ska inte komma igen.
    const { data: shown } = await admin.from('room_movies').select('tmdb_id').eq('room_id', roomId)
    const shownIds = new Set<number>((shown ?? []).map((r) => r.tmdb_id as number))
    const round: number = newRound ? (room.round ?? 1) + 1 : (room.round ?? 1)

    const region: string = room.region ?? 'SE'

    const found = await findMovies({
      providers: groupProviders,
      genreIds: room.genre_ids ?? [],
      excludeIds: shownIds,
      wanted: room.movie_count,
      region,
      // Senare omgångar hämtar fler sidor eftersom de populäraste filmerna redan har visats.
      pages: Math.min(MAX_PAGES, PAGES + 2 * (round - 1)),
    })
    if (found.length === 0) return json({ error: 'Hittade inga filmer på gruppens tjänster och valda genrer' }, 404)

    const rows = found.map((m, position) => ({ ...m, room_id: roomId, round, position }))

    const { error: insertError } = await admin.from('room_movies').insert(rows)
    if (insertError) throw insertError

    if (newRound) {
      // Alla ska rösta igen i den nya omgången.
      const { error: resetError } = await admin
        .from('participants')
        .update({ finished_voting_at: null })
        .eq('room_id', roomId)
      if (resetError) throw resetError
    }

    const { error: updateError } = await admin
      .from('rooms')
      .update({
        status: 'voting',
        round,
        picked_tmdb_id: null,
        started_at: new Date().toISOString(),
        finished_at: null,
        // Antal filmer i rummet ändras inte om en omgång råkar få färre filmer.
        ...(newRound ? {} : { movie_count: rows.length }),
      })
      .eq('id', roomId)
      .eq('status', room.status)
    if (updateError) throw updateError

    return json({ ok: true, count: rows.length })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
