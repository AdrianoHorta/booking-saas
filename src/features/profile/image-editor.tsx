import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../../components/ui/avatar'
import { Button } from '../../components/ui/button'
import { Message } from '../../components/feedback/message'
import { prepareImage } from './brand-images'

export function ImageEditor({ name, path, logo = false, onSave }: {
  name: string; path?: string | null; logo?: boolean; onSave: (image: Blob | null) => Promise<void>;
}) {
  const [selection, setSelection] = useState<{ image: Blob; preview: string } | null>(null)
  const image = selection?.image
  const preview = selection?.preview
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const lock = useRef(false)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  async function select(file?: File) {
    if (!file || lock.current) return
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try { const image = await prepareImage(file); setSelection({ image, preview: URL.createObjectURL(image) }) } catch (cause) { setError((cause as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  async function save(value: Blob | null) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try { await onSave(value); setSelection(null); setSuccess(value ? 'Imagem guardada.' : 'Imagem removida.') }
    catch (cause) { setError((cause as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={name} path={path} preview={preview} logo={logo} className="size-24 text-3xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <label className="relative inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-brand hover:bg-brand-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand">{logo ? 'Escolher logótipo' : 'Escolher fotografia'}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { void select(event.target.files?.[0]); event.target.value = '' }}
            className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
        <p className="text-xs text-muted">JPG, PNG ou WebP · até 5 MB.</p>
      </div>
    </div>
    <p className="text-xs text-muted">{logo ? 'O logótipo será público na página de reservas.' : 'A sua fotografia será pública na página de reservas das empresas onde é profissional.'}</p>
    <div className="flex flex-wrap items-center gap-4">
      {image && <><Button disabled={busy} onClick={() => void save(image)}>{busy ? 'A guardar…' : 'Guardar imagem'}</Button>
        <button type="button" disabled={busy} onClick={() => setSelection(null)} className="min-h-11 text-sm text-muted underline">Cancelar seleção</button></>}
      {!image && path && <button type="button" disabled={busy} onClick={() => void save(null)} className="min-h-11 text-sm text-brand underline underline-offset-4">{busy ? 'A remover…' : 'Remover imagem'}</button>}
    </div>
    {busy && <p role="status" className="text-sm text-muted">A preparar a imagem…</p>}
    {error && <Message error>{error}</Message>}{success && <Message>{success}</Message>}
  </div>
}
