import { Link } from 'react-router-dom'
import { useProfile } from '../lib/profile'

type Props = {
  /** Premiumrum är reklamfria för alla deltagare. */
  premiumRoom?: boolean
  size?: 'banner' | 'card'
}

/**
 * Platshållare för annonser i gratisversionen. Visas inte för Premium eller i premiumrum.
 * I en riktig produkt skulle en annonsleverantör fylla den här ytan.
 */
export default function AdSlot({ premiumRoom = false, size = 'banner' }: Props) {
  const { isPremium, profile } = useProfile()
  if (!profile || isPremium || premiumRoom) return null

  return (
    <aside
      aria-label="Annons"
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-600 bg-slate-800/40 text-center ${
        size === 'card' ? 'h-40' : 'h-20'
      }`}
    >
      <span className="text-[10px] tracking-widest text-slate-500 uppercase">Annons</span>
      <span className="text-sm text-slate-400">Annonsplats</span>
      <Link to="/premium" className="text-xs text-amber-300 hover:text-amber-200">
        Ta bort annonser med Premium
      </Link>
    </aside>
  )
}
