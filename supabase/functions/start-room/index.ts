// POST /functions/v1/start-room { roomId }
// Rumsledaren startar röstningen. Funktionen slår ihop gruppens tjänster,
// hämtar filmer från TMDB som finns på minst en av dem och sparar N filmer.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { swedishProviders, tmdb } from '../_shared/tmdb.ts'

type DiscoverMovie = {
  id: number
  title: string
  poster_path: string | null
  genre_ids: number[]
  popularity: number
  release_date?: string
}

type WatchProviders = {
  results: Record<string, { flatrate?: { provider_id: number }[] }>
}

const PAGES = 3

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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
    if (room.status !== 'lobby') return json({ error: 'Röstningen har redan startat' }, 409)

    // Gruppens samlade tjänster (unionen).
    const { data: participants } = await admin
      .from('participants')
      .select('id, services_done, participant_services(provider_id)')
      .eq('room_id', roomId)
    const ready = (participants ?? []).filter((p) => p.services_done)
    if (ready.length === 0) return json({ error: 'Ingen har valt tjänster än' }, 400)

    const groupProviders = new Set<number>()
    for (const p of ready) for (const s of p.participant_services ?? []) groupProviders.add(s.provider_id)

    // Deltagare som inte valt tjänster än tas bort så att röstningen inte fastnar på dem.
    const notReady = (participants ?? []).filter((p) => !p.services_done).map((p) => p.id)
    if (notReady.length > 0) await admin.from('participants').delete().in('id', notReady)

    const region: string = room.region ?? 'SE'

    // Hämta kandidater: | betyder ELLER, alltså minst en av gruppens tjänster.
    const pages = await Promise.all(
      Array.from({ length: PAGES }, (_, i) =>
        tmdb<{ results: DiscoverMovie[] }>('/discover/movie', {
          watch_region: region,
          with_watch_providers: [...groupProviders].join('|'),
          with_watch_monetization_types: 'flatrate',
          sort_by: 'popularity.desc',
          'vote_count.gte': 100,
          language: 'sv-SE',
          include_adult: 'false',
          page: i + 1,
        }),
      ),
    )
    const seen = new Set<number>()
    const candidates = pages.flatMap((p) => p.results).filter((m) => !seen.has(m.id) && seen.add(m.id))
    if (candidates.length === 0) return json({ error: 'Hittade inga filmer på gruppens tjänster' }, 404)

    const [genreData, allProviders] = await Promise.all([
      tmdb<{ genres: { id: number; name: string }[] }>('/genre/movie/list', { language: 'sv-SE' }),
      swedishProviders(region),
    ])
    const genreName = new Map(genreData.genres.map((g) => [g.id, g.name]))
    const providerInfo = new Map(allProviders.map((p) => [p.provider_id, p]))

    // Välj N slumpvis bland kandidaterna och kolla exakt vilka av gruppens tjänster de finns på.
    const chosen = shuffle(candidates).slice(0, room.movie_count)
    const rows = await Promise.all(
      chosen.map(async (m, position) => {
        const wp = await tmdb<WatchProviders>(`/movie/${m.id}/watch/providers`)
        const flatrate = wp.results?.[region]?.flatrate ?? []
        const providers = flatrate
          .filter((f) => groupProviders.has(f.provider_id))
          .map((f) => {
            const info = providerInfo.get(f.provider_id)
            return { id: f.provider_id, name: info?.provider_name ?? 'Okänd tjänst', logo_path: info?.logo_path ?? null }
          })
        return {
          room_id: roomId,
          position,
          tmdb_id: m.id,
          title: m.title,
          poster_path: m.poster_path,
          genres: m.genre_ids.map((id) => genreName.get(id)).filter(Boolean),
          providers,
          popularity: m.popularity,
          release_year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
        }
      }),
    )

    const { error: insertError } = await admin.from('room_movies').insert(rows)
    if (insertError) throw insertError

    const { error: updateError } = await admin
      .from('rooms')
      .update({ status: 'voting', started_at: new Date().toISOString(), movie_count: rows.length })
      .eq('id', roomId)
      .eq('status', 'lobby')
    if (updateError) throw updateError

    return json({ ok: true, count: rows.length })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
