import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-rose-500 text-white active:bg-rose-600 disabled:bg-slate-700 disabled:text-slate-400'
      : 'bg-slate-800 text-slate-100 active:bg-slate-700 disabled:text-slate-500'
  return (
    <button
      className={`w-full rounded-xl px-4 py-3 text-base font-semibold transition ${styles} ${className}`}
      {...props}
    />
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="rounded-lg bg-red-500/15 p-3 text-sm text-red-200">{children}</p>
}

export function Spinner({ label = 'Laddar…' }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-rose-400" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
