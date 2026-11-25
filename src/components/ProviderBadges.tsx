import { logoUrl } from '../lib/tmdb'
import type { Provider } from '../lib/types'

export default function ProviderBadges({ providers }: { providers: Provider[] }) {
  if (providers.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-300">Finns på</span>
      {providers.map((p) => {
        const logo = logoUrl(p.logo_path)
        return (
          <span key={p.id} className="flex items-center gap-1 rounded-full bg-black/50 py-0.5 pr-2 pl-0.5 text-xs">
            {logo && <img src={logo} alt="" className="h-5 w-5 rounded-full" />}
            {p.name}
          </span>
        )
      })}
    </div>
  )
}
