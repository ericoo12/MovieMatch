import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchProfile, setPlan } from './api'
import { isConfigured, supabase } from './supabase'
import type { Plan, Profile } from './types'

type ProfileState = {
  profile: Profile | null
  isPremium: boolean
  email: string | null
  refresh: () => Promise<void>
  changePlan: (plan: Plan) => Promise<void>
}

const ProfileContext = createContext<ProfileState | null>(null)

/** Håller den inloggades profil (plan, sparade tjänster) tillgänglig i hela appen. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isConfigured) return
    const p = await fetchProfile()
    const { data } = await supabase.auth.getUser()
    setProfile(p)
    setEmail(data.user?.email ?? null)
  }, [])

  useEffect(() => {
    refresh().catch(() => undefined)
    // Ny profil när någon loggar in eller ut.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => refresh().catch(() => undefined), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [refresh])

  const changePlan = useCallback(async (plan: Plan) => {
    setProfile(await setPlan(plan))
  }, [])

  return (
    <ProfileContext.Provider value={{ profile, isPremium: profile?.plan === 'premium', email, refresh, changePlan }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileState {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile måste användas inuti ProfileProvider')
  return ctx
}
