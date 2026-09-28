import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

export function Dialog({ children, label, onClose, preventClose = false, compact = false, returnFocusRef }: {
  children: ReactNode
  label: string
  onClose: () => void
  preventClose?: boolean
  compact?: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = document.activeElement
    // An upload trigger may remount while the modal is open; resolve it on close.
    const resolveReturnFocus = () => returnFocusRef?.current ?? previousFocus
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      const target = resolveReturnFocus()
      if (target instanceof HTMLElement) target.focus()
    }
  }, [returnFocusRef])
  return <dialog ref={ref} aria-label={label} onCancel={(event) => { event.preventDefault(); if (!preventClose) onClose() }}
    className={`fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-[3px] border border-line bg-white text-ink shadow-[0_24px_80px_rgba(60,35,20,0.18)] backdrop:bg-black/30 backdrop:backdrop-blur-sm ${compact ? 'max-w-md p-5 sm:p-6' : 'max-w-xl p-8 sm:p-10'}`}>
    {children}
  </dialog>
}
