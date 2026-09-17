import { useEffect, useRef, type ReactNode } from 'react'

export function ServiceDialog({ children, label, onClose }: {
  children: ReactNode
  label: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])
  return <dialog ref={ref} aria-label={label} onCancel={onClose}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-[3px] border border-line bg-white p-8 text-ink shadow-[0_24px_80px_rgba(60,35,20,0.18)] backdrop:bg-black/30 backdrop:backdrop-blur-sm sm:p-10">
    {children}
  </dialog>
}
