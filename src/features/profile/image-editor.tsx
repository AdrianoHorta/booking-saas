import { useEffect, useId, useRef, useState } from 'react'
import { Avatar } from '../../components/ui/avatar'
import { Button } from '../../components/ui/button'
import { Message } from '../../components/feedback/message'
import { Dialog } from '../../components/ui/dialog'
import { brandImageUrl, defaultImageFrame, frameImage, prepareImage, type ImageFrame } from './brand-images'

export function ImageEditor({ name, path, logo = false, onSave }: {
  name: string; path?: string | null; logo?: boolean; onSave: (image: Blob | null) => Promise<void>;
}) {
  const [selection, setSelection] = useState<Blob | null>(null)
  const [frame, setFrame] = useState(defaultImageFrame)
  const [rendered, setRendered] = useState<{ source: Blob; frame: ImageFrame; image: Blob; preview: string } | null>(null)
  const image = rendered?.source === selection && rendered?.frame === frame ? rendered.image : undefined
  const preview = rendered?.source === selection ? rendered?.preview : undefined
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const lock = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const [editingExisting, setEditingExisting] = useState(false)
  const instructionsId = useId()
  const drag = useRef<{ id: number; startX: number; startY: number; x: number; y: number; size: number } | null>(null)
  useEffect(() => () => { if (rendered) URL.revokeObjectURL(rendered.preview) }, [rendered])
  useEffect(() => {
    if (!selection) return
    let cancelled = false
    void frameImage(selection, frame, logo).then((image) => {
      if (!cancelled) setRendered({ source: selection, frame, image, preview: URL.createObjectURL(image) })
    }).catch(() => {
      if (!cancelled) setError('Não foi possível preparar o enquadramento. Escolha novamente a imagem.')
    })
    return () => { cancelled = true }
  }, [selection, frame, logo])
  function cancelSelection() { if (lock.current) return; drag.current = null; setSelection(null); setRendered(null); setError(''); setSuccess('') }
  function moveImage(x: number, y: number) {
    setError('')
    setFrame((current) => ({ ...current, x: Math.max(-50, Math.min(50, x)), y: Math.max(-50, Math.min(50, y)) }))
  }
  async function select(file?: File) {
    if (!file || lock.current) return
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try { const source = await prepareImage(file); setEditingExisting(false); setSelection(source); setFrame(defaultImageFrame) } catch (cause) { setError((cause as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  async function editExisting() {
    const url = brandImageUrl(path)
    if (!url || lock.current) return
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' })
      if (!response.ok) throw new Error('Image unavailable')
      const blob = await response.blob()
      const source = await prepareImage(new File([blob], 'image', { type: blob.type }))
      setEditingExisting(true); setSelection(source)
      setFrame(defaultImageFrame)
    } catch { setError('Não foi possível abrir a imagem guardada. Escolha o ficheiro novamente para ajustar o enquadramento.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function save(value: Blob | null) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try { await onSave(value); setSelection(null); setRendered(null); setSuccess(value ? 'Imagem guardada.' : 'Imagem removida.') }
    catch (cause) { setError((cause as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={name} path={path} logo={logo} className="size-24 text-3xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <label className="relative inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-brand hover:bg-brand-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand">{logo ? 'Escolher logótipo' : 'Escolher fotografia'}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { void select(event.target.files?.[0]); event.target.value = '' }}
            className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
        <p className="text-xs text-muted">JPG, PNG ou WebP · até 5 MB.</p>
      </div>
    </div>
    {selection && <Dialog compact label="Ajustar imagem" onClose={cancelSelection} preventClose={busy} returnFocusRef={editingExisting ? editButtonRef : fileInputRef}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-3xl">Ajustar imagem</h2>
          <button type="button" aria-label="Fechar ajuste de imagem" disabled={busy} onClick={cancelSelection} className="-mt-2 flex size-11 shrink-0 items-center justify-center text-2xl text-muted">×</button>
        </div>
        <p id={instructionsId} className="text-sm leading-relaxed text-muted">Arraste a imagem para a posicionar e ajuste o zoom. Também pode usar as teclas de direção sobre a imagem.</p>
        <div role="group" aria-label="Posicionar imagem" aria-describedby={instructionsId} tabIndex={busy ? -1 : 0}
          className="relative mx-auto aspect-square w-full max-w-56 touch-none select-none overflow-hidden rounded-full bg-brand-soft outline-offset-4 focus-visible:outline-2 focus-visible:outline-brand cursor-grab active:cursor-grabbing"
          onPointerDown={(event) => {
            if (busy || !event.isPrimary || event.button !== 0) return
            event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: frame.x, y: frame.y, size: event.currentTarget.getBoundingClientRect().width }
          }}
          onPointerMove={(event) => {
            const start = drag.current
            if (busy || !start || start.id !== event.pointerId) return
            moveImage(start.x + (event.clientX - start.startX) / start.size * 100, start.y + (event.clientY - start.startY) / start.size * 100)
          }}
          onPointerUp={(event) => { if (drag.current?.id === event.pointerId) { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId) } }}
          onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
          onKeyDown={(event) => {
            if (busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
            event.preventDefault()
            const step = event.shiftKey ? 10 : 2
            moveImage(frame.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), frame.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0))
          }}>
          <div className="pointer-events-none size-full"><Avatar name={name} path={path} preview={preview} logo={logo} className="size-full text-5xl" /></div>
        </div>
        <label className="block text-sm text-muted">
          <span className="flex justify-between gap-3"><span>Zoom da imagem</span><span>{Math.round(frame.zoom * 100)}%</span></span>
          <input type="range" aria-label="Zoom da imagem" min={0.5} max={3} step={0.05} value={frame.zoom} disabled={busy}
            onChange={(event) => { setError(''); setFrame((current) => ({ ...current, zoom: Number(event.target.value) })) }} className="mt-1 min-h-11 w-full cursor-pointer accent-brand" />
        </label>
        <button type="button" disabled={busy} onClick={() => { setError(''); setFrame(defaultImageFrame) }} className="min-h-11 text-sm text-brand underline underline-offset-4">Repor enquadramento</button>
        {error && <Message error>{error}</Message>}
        {busy && <p role="status" className="text-sm text-muted">A guardar a imagem…</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-3">
          <button type="button" disabled={busy} onClick={cancelSelection} className="min-h-11 px-4 text-sm text-muted underline">Cancelar</button>
          <Button disabled={busy || !image} onClick={() => { if (image) void save(image) }}>{busy ? 'A guardar…' : 'Guardar imagem'}</Button>
        </div>
      </div>
    </Dialog>}
    <p className="text-xs text-muted">{logo ? 'O logótipo será público na página de reservas.' : 'A sua fotografia será pública na página de reservas das empresas onde é profissional.'}</p>
    <div className="flex flex-wrap items-center gap-4">
      {!selection && path && <>
        <button ref={editButtonRef} type="button" disabled={busy} onClick={() => void editExisting()} className="min-h-11 text-sm text-brand underline underline-offset-4">Ajustar enquadramento</button>
        <button type="button" disabled={busy} onClick={() => void save(null)} className="min-h-11 text-sm text-brand underline underline-offset-4">Remover imagem</button>
      </>}
    </div>
    {busy && !selection && <p role="status" className="text-sm text-muted">A preparar a imagem…</p>}
    {error && !selection && <Message error>{error}</Message>}{success && <Message>{success}</Message>}
  </div>
}
