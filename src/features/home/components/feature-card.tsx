type FeatureCardProps = {
  number: string
  title: string
  description: string
}

export function FeatureCard({ number, title, description }: FeatureCardProps) {
  return (
    <article className="grid gap-4 border-t border-line py-7 sm:grid-cols-[40px_1fr] sm:gap-6">
      <span aria-hidden="true" className="pt-1 font-display text-lg italic text-brand">{number}</span>
      <div>
        <h3 className="mb-3 font-display text-2xl font-normal tracking-tight sm:text-3xl">{title}</h3>
        <p className="max-w-lg text-sm leading-7 text-muted">{description}</p>
      </div>
    </article>
  )
}
