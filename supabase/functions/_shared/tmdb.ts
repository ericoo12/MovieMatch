// Tunn klient för TMDB. Nyckeln ligger bara här på servern.
// TMDB_API_KEY kan vara antingen "API Read Access Token" (börjar med eyJ) eller v3-nyckeln.

const BASE = 'https://api.themoviedb.org/3'

export type TmdbProvider = {
  provider_id: number
  provider_name: string
  logo_path: string | null
  display_priority?: number
  display_priorities?: Record<string, number>
}

export async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const key = Deno.env.get('TMDB_API_KEY')
  if (!key) throw new Error('TMDB_API_KEY saknas i Supabase secrets')

  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

  const headers: Record<string, string> = { accept: 'application/json' }
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
  else url.searchParams.set('api_key', key)

  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`TMDB ${path} svarade ${res.status}`)
  return (await res.json()) as T
}

export async function swedishProviders(region: string): Promise<TmdbProvider[]> {
  const data = await tmdb<{ results: TmdbProvider[] }>('/watch/providers/movie', {
    watch_region: region,
    language: 'sv-SE',
  })
  return data.results
    .map((p) => ({ ...p, display_priority: p.display_priorities?.[region] ?? p.display_priority ?? 999 }))
    .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
}
