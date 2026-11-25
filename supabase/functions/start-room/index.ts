// POST /functions/v1/start-room { roomId }
// Rumsledaren startar röstningen. Funktionen slår ihop gruppens tjänster,
// hämtar filmer från TMDB som finns på minst en av dem och sparar N filmer.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { movieWeight, readableTitle, shuffle, weightedSample } from '../_shared/selection.ts'
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

/** /movie/{id} med append_to_response=watch/providers,translations,images */
type MovieDetails = {
  id: number
  title: string
  original_title: string
  poster_path: string | null
  belongs_to_collection: { id: number } | null
  'watch/providers'?: {
    results: Record<string, { flatrate?: ProviderEntry[]; free?: ProviderEntry[]; ads?: ProviderEntry[] }>
  }
  translations?: { translations: { iso_639_1: string; data: { title?: string } }[] }
  images?: { posters: { file_path: string }[] }
}

const PAGES = 6

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
          // Rumsledarens genrefilter. | betyder ELLER: filmen ska ha minst en av genrerna.
          ...(room.genre_ids?.length ? { with_genres: room.genre_ids.join('|') } : {}),
          language: 'sv-SE',
          include_adult: 'false',
          page: i + 1,
        }),
      ),
    )
    const seen = new Set<number>()
    const candidates = pages.flatMap((p) => p.results).filter((m) => !seen.has(m.id) && seen.add(m.id))
    if (candidates.length === 0) return json({ error: 'Hittade inga filmer på gruppens tjänster och valda genrer' }, 404)

    const [genreData, allProviders] = await Promise.all([
      tmdb<{ genres: { id: number; name: string }[] }>('/genre/movie/list', { language: 'sv-SE' }),
      swedishProviders(region),
    ])
    const genreName = new Map(genreData.genres.map((g) => [g.id, g.name]))
    const providerInfo = new Map(allProviders.map((p) => [p.provider_id, p]))

    type Checked = {
      movie: DiscoverMovie
      title: string
      poster: string
      inCollection: boolean
      providers: { id: number; name: string; logo_path: string | null }[]
    }

    // Hämtar detaljer för en film: läsbar titel, omslag, filmserie och gruppens tjänster.
    // Returnerar null om filmen saknar omslag eller inte finns på någon av gruppens tjänster.
    async function check(movie: DiscoverMovie): Promise<Checked | null> {
      const d = await tmdb<MovieDetails>(`/movie/${movie.id}`, {
        language: 'sv-SE',
        append_to_response: 'watch/providers,translations,images',
        include_image_language: 'sv,en,null',
      })
      const poster = d.poster_path ?? d.images?.posters?.[0]?.file_path ?? null
      if (!poster) return null

      const offers = d['watch/providers']?.results?.[region] ?? {}
      const available = [...(offers.flatrate ?? []), ...(offers.free ?? []), ...(offers.ads ?? [])]
      const ids = [...new Set(available.map((f) => f.provider_id))].filter((id) => groupProviders.has(id))
      if (ids.length === 0) return null

      return {
        movie,
        title: readableTitle({ ...d, translations: d.translations?.translations }),
        poster,
        inCollection: d.belongs_to_collection !== null,
        providers: ids.map((id) => {
          const info = providerInfo.get(id)
          return { id, name: info?.provider_name ?? 'Okänd tjänst', logo_path: info?.logo_path ?? null }
        }),
      }
    }

    // Discover-filtret är inte helt exakt, så varje film kontrolleras. Vi samlar ungefär dubbelt
    // så många godkända filmer som behövs och gör sedan ett viktat urval, där filmer i en
    // filmserie (t.ex. Harry Potter) har lägre chans att komma med.
    const wanted = room.movie_count
    const shuffled = shuffle(candidates)
    const pool: Checked[] = []
    for (let i = 0; i < shuffled.length && pool.length < wanted * 2; i += wanted) {
      const batch = await Promise.all(shuffled.slice(i, i + wanted).map(check))
      for (const c of batch) if (c) pool.push(c)
    }
    if (pool.length === 0) return json({ error: 'Hittade inga filmer på gruppens tjänster' }, 404)

    const picked = weightedSample(pool, wanted, movieWeight)

    const rows = picked.map(({ movie: m, title, poster, providers }, position) => ({
      room_id: roomId,
      position,
      tmdb_id: m.id,
      title,
      poster_path: poster,
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
