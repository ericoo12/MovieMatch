// POST /functions/v1/solo-movies { providers?, genreIds?, excludeIds? }
// Solo Swipe (Premium): filmer på dina egna tjänster som du inte redan har sparat eller sett.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { findMovies } from '../_shared/pick.ts'

const BATCH = 15

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = (await req.json().catch(() => ({}))) as {
      providers?: number[]
      genreIds?: number[]
      excludeIds?: number[]
    }

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Inte inloggad' }, 401)
    const userId = userData.user.id

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profile } = await admin.from('profiles').select('*').eq('user_id', userId).maybeSingle()
    if (profile?.plan !== 'premium') return json({ error: 'Solo Swipe ingår i Premium' }, 403)

    const providers = new Set<number>(body.providers?.length ? body.providers : (profile.saved_provider_ids ?? []))
    if (providers.size === 0) return json({ error: 'Välj dina streamingtjänster först' }, 400)

    // Hoppa över filmer du redan har sparat, satt på watchlist eller sett.
    const { data: saved } = await admin.from('saved_movies').select('tmdb_id').eq('user_id', userId)
    const exclude = new Set<number>([...(saved ?? []).map((r) => r.tmdb_id as number), ...(body.excludeIds ?? [])])

    const movies = await findMovies({
      providers,
      genreIds: body.genreIds ?? [],
      excludeIds: exclude,
      wanted: BATCH,
      region: 'SE',
      pages: 8,
    })
    return json({ movies })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
