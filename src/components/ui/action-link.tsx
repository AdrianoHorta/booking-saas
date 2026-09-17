import { Link, type LinkProps } from 'react-router'

type ActionLinkProps = Omit<LinkProps, 'className'> & {
  variant?: 'primary' | 'secondary'
}

const variants = {
  primary: 'border-brand bg-brand text-white hover:border-brand-hover hover:bg-brand-hover',
  secondary: 'border-line bg-surface text-ink hover:bg-brand-soft',
}

export function ActionLink({ variant = 'primary', ...props }: ActionLinkProps) {
  return (
    <Link
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-6 rounded-sm border px-6 py-3 text-sm font-medium tracking-wide motion-safe:transition-colors ${variants[variant]}`}
    />
  )
}
