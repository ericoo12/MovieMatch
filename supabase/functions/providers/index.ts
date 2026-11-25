// GET/POST /functions/v1/providers -> streamingtjänster i Sverige för tjänsteväljaren.
// Funktionen är öppen (ingen inloggning krävs), så svaret cachas för att
// ingen ska kunna bränna vår TMDB-kvot genom att anropa den många gånger.
import { corsHeaders, json } from '../_shared/cors.ts'
import { swedishProviders } from '../_shared/tmdb.ts'

const CACHE_SECONDS = 6 * 60 * 60

type ProviderList = { id: number; name: string; logo_path: string | null }[]
let cache: { list: ProviderList; expires: number } | null = null

async function loadProviders(): Promise<ProviderList> {
  if (cache && cache.expires > Date.now()) return cache.list

  const providers = await swedishProviders('SE')
  // Ta bort kanaler inuti andra tjänster, butiker och barnvarianter så att listan blir begriplig.
  const hidden = /channel|store|kids|justwatch|with ads|standard/i
  const list = providers
    .filter((p) => !hidden.test(p.provider_name))
    .slice(0, 20)
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logo_path: p.logo_path }))

  cache = { list, expires: Date.now() + CACHE_SECONDS * 1000 }
  return list
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const res = json({ providers: await loadProviders() })
    // Låter även webbläsaren och Supabase CDN cacha svaret.
    res.headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`)
    return res
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
