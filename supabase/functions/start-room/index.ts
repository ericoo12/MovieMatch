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

type ProviderEntry = { provider_id: number }
type WatchProviders = {
  results: Record<string, { flatrate?: ProviderEntry[]; free?: ProviderEntry[]; ads?: ProviderEntry[] }>
}

const PAGES = 5

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
          // flatrate = ingår i abonnemang, free/ads = gratistjänster som SVT Play
          with_watch_monetization_types: 'flatrate|free|ads',
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

    // Gruppens tjänster som en film finns på (abonnemang eller gratis).
    async function groupProvidersFor(movieId: number) {
      const wp = await tmdb<WatchProviders>(`/movie/${movieId}/watch/providers`)
      const offers = wp.results?.[region] ?? {}
      const available = [...(offers.flatrate ?? []), ...(offers.free ?? []), ...(offers.ads ?? [])]
      const ids = [...new Set(available.map((f) => f.provider_id))].filter((id) => groupProviders.has(id))
      return ids.map((id) => {
        const info = providerInfo.get(id)
        return { id, name: info?.provider_name ?? 'Okänd tjänst', logo_path: info?.logo_path ?? null }
      })
    }

    // Discover-filtret är inte helt exakt, så kontrollera varje film och hoppa över
    // de som inte finns på någon av gruppens tjänster. Kontrollera i omgångar tills vi har N.
    const shuffled = shuffle(candidates)
    const picked: { movie: DiscoverMovie; providers: Awaited<ReturnType<typeof groupProvidersFor>> }[] = []
    for (let i = 0; i < shuffled.length && picked.length < room.movie_count; i += room.movie_count) {
      const batch = shuffled.slice(i, i + room.movie_count)
      const checked = await Promise.all(batch.map(async (movie) => ({ movie, providers: await groupProvidersFor(movie.id) })))
      for (const c of checked) if (c.providers.length > 0 && picked.length < room.movie_count) picked.push(c)
    }
    if (picked.length === 0) return json({ error: 'Hittade inga filmer på gruppens tjänster' }, 404)

    const rows = picked.map(({ movie: m, providers }, position) => ({
      room_id: roomId,
      position,
      tmdb_id: m.id,
      title: m.title,
      poster_path: m.poster_path,
      genres: m.genre_ids.map((id) => genreName.get(id)).filter(Boolean),
      providers,
      popularity: m.popularity,
      release_year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    }))

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
