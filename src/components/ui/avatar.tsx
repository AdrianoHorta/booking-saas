import { useState } from 'react'
import { brandImageUrl } from '../../features/profile/brand-images'

export function Avatar({ name, path, className = 'size-12', logo = false, preview }: {
  name: string; path?: string | null; className?: string; logo?: boolean; preview?: string;
}) {
  const src = preview ?? brandImageUrl(path)
  const [failedSrc, setFailedSrc] = useState<string>()
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '·'
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-brand-soft font-display text-brand ${className}`}>
    {src && failedSrc !== src ? <img src={src} alt={logo ? `Logótipo de ${name}` : `Fotografia de ${name}`} referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)} className={`size-full ${logo ? 'object-contain p-2' : 'object-cover'}`} />
      : <span aria-hidden="true">{initials}</span>}
  </span>
}
