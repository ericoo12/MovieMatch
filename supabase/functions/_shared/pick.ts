// Hittar filmer som finns på minst en av de givna tjänsterna. Används av både
// start-room (gruppens filmer) och solo-movies (Solo Swipe).
import { movieWeight, readableOverview, readableTitle, shuffle, weightedSample } from './selection.ts'
import { swedishProviders, tmdb } from './tmdb.ts'

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
  overview: string | null
  poster_path: string | null
  belongs_to_collection: { id: number } | null
  'watch/providers'?: {
    results: Record<string, { flatrate?: ProviderEntry[]; free?: ProviderEntry[]; ads?: ProviderEntry[] }>
  }
  translations?: { translations: { iso_639_1: string; data: { title?: string; overview?: string } }[] }
  images?: { posters: { file_path: string }[] }
}

export type FoundMovie = {
  tmdb_id: number
  title: string
  overview: string | null
  poster_path: string
  genres: string[]
  providers: { id: number; name: string; logo_path: string | null }[]
  popularity: number
  release_year: number | null
}

type Options = {
  providers: Set<number>
  genreIds: number[]
  /** Filmer som inte får komma med, t.ex. redan visade eller redan sedda. */
  excludeIds: Set<number>
  wanted: number
  region: string
  pages: number
}

export async function findMovies(o: Options): Promise<FoundMovie[]> {
  // | betyder ELLER: minst en av tjänsterna och minst en av genrerna.
  const pages = await Promise.all(
    Array.from({ length: o.pages }, (_, i) =>
      tmdb<{ results: DiscoverMovie[] }>('/discover/movie', {
        watch_region: o.region,
        with_watch_providers: [...o.providers].join('|'),
        // flatrate = ingår i abonnemang, free/ads = gratistjänster som SVT Play
        with_watch_monetization_types: 'flatrate|free|ads',
        sort_by: 'popularity.desc',
        'vote_count.gte': 100,
        ...(o.genreIds.length ? { with_genres: o.genreIds.join('|') } : {}),
        language: 'sv-SE',
        include_adult: 'false',
        page: i + 1,
      }),
    ),
  )
  const seen = new Set<number>()
  const candidates = pages
    .flatMap((p) => p.results)
    .filter((m) => !o.excludeIds.has(m.id) && !seen.has(m.id) && seen.add(m.id))
  if (candidates.length === 0) return []

  const [genreData, allProviders] = await Promise.all([
    tmdb<{ genres: { id: number; name: string }[] }>('/genre/movie/list', { language: 'sv-SE' }),
    swedishProviders(o.region),
  ])
  const genreName = new Map(genreData.genres.map((g) => [g.id, g.name]))
  const providerInfo = new Map(allProviders.map((p) => [p.provider_id, p]))

  type Checked = { movie: DiscoverMovie; found: FoundMovie; inCollection: boolean }

  // Detaljer för en film: läsbar titel, omslag, filmserie och vilka av tjänsterna den finns på.
  // null om filmen saknar omslag eller inte finns på någon av tjänsterna.
  async function check(movie: DiscoverMovie): Promise<Checked | null> {
    const d = await tmdb<MovieDetails>(`/movie/${movie.id}`, {
      language: 'sv-SE',
      append_to_response: 'watch/providers,translations,images',
      include_image_language: 'sv,en,null',
    })
    const poster = d.poster_path ?? d.images?.posters?.[0]?.file_path ?? null
    if (!poster) return null

    const offers = d['watch/providers']?.results?.[o.region] ?? {}
    const available = [...(offers.flatrate ?? []), ...(offers.free ?? []), ...(offers.ads ?? [])]
    const ids = [...new Set(available.map((f) => f.provider_id))].filter((id) => o.providers.has(id))
    if (ids.length === 0) return null

    return {
      movie,
      inCollection: d.belongs_to_collection !== null,
      found: {
        tmdb_id: movie.id,
        title: readableTitle({ ...d, translations: d.translations?.translations }),
        overview: readableOverview({ ...d, translations: d.translations?.translations }),
        poster_path: poster,
        genres: movie.genre_ids.map((id) => genreName.get(id)).filter((g): g is string => Boolean(g)),
        providers: ids.map((id) => {
          const info = providerInfo.get(id)
          return { id, name: info?.provider_name ?? 'Okänd tjänst', logo_path: info?.logo_path ?? null }
        }),
        popularity: movie.popularity,
        release_year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
      },
    }
  }

  // Discover-filtret är inte helt exakt, så varje film kontrolleras. Vi samlar ungefär dubbelt
  // så många godkända filmer som behövs och gör sedan ett viktat urval, där filmer i en
  // filmserie (t.ex. Harry Potter) har lägre chans att komma med.
  const shuffled = shuffle(candidates)
  const pool: Checked[] = []
  for (let i = 0; i < shuffled.length && pool.length < o.wanted * 2; i += o.wanted) {
    const batch = await Promise.all(shuffled.slice(i, i + o.wanted).map(check))
    for (const c of batch) if (c) pool.push(c)
  }
  return weightedSample(pool, o.wanted, movieWeight).map((c) => c.found)
}
