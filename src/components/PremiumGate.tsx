import { Link } from 'react-router-dom'
import { Button } from './ui'

/** Visas när en gratisanvändare öppnar en premiumfunktion. */
export default function PremiumGate({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold tracking-wide text-amber-300 uppercase">
        Premium
      </span>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-slate-400">{text}</p>
      <Link to="/premium" className="w-full">
        <Button variant="gold">Uppgradera till Premium</Button>
      </Link>
    </div>
  )
}
