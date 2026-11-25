import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'muted' }

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-rose-500 text-white hover:bg-rose-400 active:bg-rose-600 disabled:bg-slate-700 disabled:text-slate-400',
    secondary:
      'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-600 disabled:text-slate-500 disabled:hover:bg-slate-800',
    // För knappar som ligger på ett mörkgrått kort.
    muted: 'bg-slate-700 text-slate-100 hover:bg-slate-600 active:bg-slate-500',
  }[variant]
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
