import { useEffect, useRef } from 'react'

/** Move focus only when the inline confirmation changes, never on initial render. */
export function useConfirmationFocus(confirming: boolean) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const previous = useRef(confirming)
  useEffect(() => {
    if (previous.current !== confirming) {
      const target = confirming ? keepRef : triggerRef
      target.current?.focus()
      previous.current = confirming
    }
  }, [confirming])
  return { triggerRef, keepRef }
}
