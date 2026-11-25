// GET/POST /functions/v1/providers -> streamingtjänster och filmgenrer i Sverige för lobbyn.
// Funktionen är öppen (ingen inloggning krävs), så svaret cachas för att
// ingen ska kunna bränna vår TMDB-kvot genom att anropa den många gånger.
import { corsHeaders, json } from '../_shared/cors.ts'
import { swedishProviders, tmdb } from '../_shared/tmdb.ts'

const CACHE_SECONDS = 6 * 60 * 60

type Lists = {
  providers: { id: number; name: string; logo_path: string | null }[]
  genres: { id: number; name: string }[]
}
let cache: { data: Lists; expires: number } | null = null

async function load(): Promise<Lists> {
  if (cache && cache.expires > Date.now()) return cache.data

  const [providers, genreData] = await Promise.all([
    swedishProviders('SE'),
    tmdb<{ genres: { id: number; name: string }[] }>('/genre/movie/list', { language: 'sv-SE' }),
  ])
  // Ta bort kanaler inuti andra tjänster, butiker och barnvarianter så att listan blir begriplig.
  const hidden = /channel|store|kids|justwatch|with ads|standard/i
  const data: Lists = {
    providers: providers
      .filter((p) => !hidden.test(p.provider_name))
      .slice(0, 20)
      .map((p) => ({ id: p.provider_id, name: p.provider_name, logo_path: p.logo_path })),
    genres: genreData.genres
      .map((g) => ({ id: g.id, name: g.name.charAt(0).toUpperCase() + g.name.slice(1) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'sv')),
  }

  cache = { data, expires: Date.now() + CACHE_SECONDS * 1000 }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const res = json(await load())
    // Låter även webbläsaren och Supabase CDN cacha svaret.
    res.headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`)
    return res
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
