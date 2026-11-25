import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ErrorText } from '../components/ui'
import { useProfile } from '../lib/profile'

const FREE = [
  'Skapa obegränsat antal filmrum',
  'Bjud in vänner via kod eller länk',
  'Swipa och matcha tillsammans',
  'Filtrera efter genre',
  'Filtrera efter streamingtjänst',
  'Ingen registrering krävs',
  'Anslut till vänners premiumfilmrum',
]

const GROUPS = [
  'Skapa och spara permanenta grupper',
  'Spara gemensamma matchningar',
  'Historik över sedda filmer',
  'Gemensamma watchlists',
]

const PREMIUM = [
  'Solo Swipe – upptäck filmer på egen hand',
  'Spara favoritfilmer och watchlists',
  'Personlig filmhistorik',
  'Spara dina streamingtjänster',
  'Helt reklamfri upplevelse',
  'Dela rummets premiumfördelar med dina vänner',
]

function Check({ children, gold }: { children: string; gold?: boolean }) {
  return (
    <li className="flex gap-2 text-sm">
      <span className={gold ? 'text-amber-300' : 'text-emerald-400'}>✓</span>
      <span>{children}</span>
    </li>
  )
}

export default function Pricing() {
  const navigate = useNavigate()
  const { isPremium, changePlan } = useProfile()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upgrade() {
    setBusy(true)
    setError(null)
    try {
      await changePlan('premium')
      setConfirming(false)
      navigate('/profil?valkommen=1')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Välj din plan</h1>
        <p className="text-slate-400">Börja gratis. Uppgradera när du vill ha mer.</p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
        <div>
          <h2 className="text-lg font-bold">MovieMatch Free</h2>
          <p className="text-3xl font-bold">
            0 kr<span className="text-base font-normal text-slate-400">/mån</span>
          </p>
          <p className="mt-1 text-slate-300">Hitta nästa film tillsammans.</p>
        </div>
        <ul className="flex flex-col gap-2">
          {FREE.map((f) => (
            <Check key={f}>{f}</Check>
          ))}
        </ul>
        <p className="text-xs text-slate-400">Innehåller annonser</p>
        <Button variant="muted" onClick={() => navigate('/')}>
          {isPremium ? 'Till startsidan' : 'Fortsätt gratis'}
        </Button>
      </section>

      <section className="relative flex flex-col gap-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-400/10 to-slate-800/60 p-5">
        <span className="absolute -top-3 right-4 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-slate-900">
          Populärast
        </span>
        <div>
          <h2 className="text-lg font-bold">MovieMatch Premium</h2>
          <p className="text-3xl font-bold">
            29 kr<span className="text-base font-normal text-slate-400">/mån</span>
          </p>
          <p className="mt-1 text-slate-300">En filmupplevelse anpassad efter dig och dina vänner.</p>
        </div>
        <p className="text-sm font-semibold">Allt som ingår i Free</p>
        <div>
          <p className="mb-2 text-sm font-semibold text-amber-200">Dina filmgrupper</p>
          <ul className="flex flex-col gap-2">
            {GROUPS.map((f) => (
              <Check key={f} gold>
                {f}
              </Check>
            ))}
          </ul>
        </div>
        <ul className="flex flex-col gap-2">
          {PREMIUM.map((f) => (
            <Check key={f} gold>
              {f}
            </Check>
          ))}
        </ul>
        {isPremium ? (
          <p className="rounded-xl bg-amber-400/15 p-3 text-center text-sm font-semibold text-amber-200">
            Du har Premium
          </p>
        ) : (
          <Button variant="gold" onClick={() => setConfirming(true)}>
            Uppgradera till Premium
          </Button>
        )}
      </section>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-slate-800 p-5"
          >
            <h2 className="text-lg font-bold">Bekräfta Premium</h2>
            <div className="flex justify-between rounded-xl bg-slate-900 p-3 text-sm">
              <span>MovieMatch Premium</span>
              <span className="font-semibold">29 kr/mån</span>
            </div>
            <p className="rounded-lg bg-sky-500/15 p-3 text-xs text-sky-200">
              Testläge: ingen betalning görs. I den färdiga produkten sker betalningen här.
            </p>
            <ErrorText>{error}</ErrorText>
            <Button variant="gold" onClick={upgrade} disabled={busy}>
              {busy ? 'Aktiverar…' : 'Starta Premium'}
            </Button>
            <Button variant="muted" onClick={() => setConfirming(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
