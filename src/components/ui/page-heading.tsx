type PageHeadingProps = {
  eyebrow: string
  title: string
  description: string
}

export function PageHeading({ eyebrow, title, description }: PageHeadingProps) {
  return (
    <div className="max-w-3xl">
      <p className="editorial-label mb-6 text-brand">{eyebrow}</p>
      <h1 className="font-display text-4xl font-normal leading-[1.12] tracking-tight sm:text-6xl">{title}</h1>
      <p className="mt-7 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{description}</p>
    </div>
  )
}
