import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'saknas', {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Ger en anonym session. Sparas i webbläsaren så att en omladdning ger samma deltagare. */
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: signIn, error } = await supabase.auth.signInAnonymously()
  if (error || !signIn.user) throw new Error(error?.message ?? 'Kunde inte skapa session')
  return signIn.user.id
}
