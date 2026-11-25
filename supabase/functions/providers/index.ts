// GET/POST /functions/v1/providers -> streamingtjänster i Sverige för tjänsteväljaren.
import { corsHeaders, json } from '../_shared/cors.ts'
import { swedishProviders } from '../_shared/tmdb.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const providers = await swedishProviders('SE')
    // Ta bort kanaler inuti andra tjänster, butiker och barnvarianter så att listan blir begriplig.
    const hidden = /channel|store|kids|justwatch|with ads|standard/i
    const list = providers
      .filter((p) => !hidden.test(p.provider_name))
      .slice(0, 20)
      .map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
      logo_path: p.logo_path,
    }))
    return json({ providers: list })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
