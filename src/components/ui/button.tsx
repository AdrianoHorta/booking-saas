import type { ComponentProps } from 'react'

export function Button({ type = 'button', className = '', ...props }: ComponentProps<'button'>) {
  return <button {...props} type={type} className={`inline-flex min-h-12 items-center justify-center gap-3 rounded-sm border border-brand bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 ${className}`} />
}
