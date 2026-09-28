import { getSupabase } from '../../lib/supabase/client'
import { supabaseEnv } from '../../lib/env'

export const imageBucket = 'brand-images'
const imagePath = /^(users|businesses)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/
export function brandImageUrl(path?: string | null) {
  if (!path) return undefined
  // Preserve existing external HTTPS logos. New uploads use the managed bucket.
  if (/^https:\/\//i.test(path)) return path
  return supabaseEnv && imagePath.test(path) ? `${supabaseEnv.url}/storage/v1/object/public/${imageBucket}/${path}` : undefined
}

export async function prepareImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Escolha uma imagem JPG, PNG ou WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter até 5 MB.')
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) }
  catch { throw new Error('Não foi possível abrir esta imagem. Escolha outro ficheiro.') }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) throw new Error('Escolha uma imagem com até 40 megapíxeis.')
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível preparar a imagem neste browser.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
    if (!blob || blob.type !== 'image/webp') throw new Error('Este browser não suporta o envio da imagem. Experimente um browser atualizado.')
    return blob
  } finally { bitmap.close() }
}

export async function uploadBrandImage(scope: 'users' | 'businesses', id: string, image: Blob) {
  const path = `${scope}/${id}/${crypto.randomUUID()}.webp`
  if (!imagePath.test(path)) throw new Error('Destino da imagem inválido.')
  const { error } = await getSupabase().storage.from(imageBucket).upload(path, image, { contentType: 'image/webp', cacheControl: '3600', upsert: false })
  if (error) throw new Error('Não foi possível enviar a imagem. Verifique a ligação e tente novamente.')
  return path
}

export type ImageFrame = { zoom: number; x: number; y: number }
export const defaultImageFrame: ImageFrame = { zoom: 1, x: 0, y: 0 }

// Export the same square viewport shown in the editor. The circular mask belongs
// to the avatar UI, so the stored image also works in rectangular placements.
export async function frameImage(image: Blob, frame: ImageFrame, logo: boolean): Promise<Blob> {
  if (!Number.isFinite(frame.zoom) || frame.zoom < 0.5 || frame.zoom > 3 ||
      !Number.isFinite(frame.x) || Math.abs(frame.x) > 50 || !Number.isFinite(frame.y) || Math.abs(frame.y) > 50) {
    throw new Error('O enquadramento da imagem não é válido.')
  }
  const bitmap = await createImageBitmap(image)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 768; canvas.height = 768
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível preparar a imagem neste browser.')
    const scale = (logo ? Math.min(768 / bitmap.width, 768 / bitmap.height) : Math.max(768 / bitmap.width, 768 / bitmap.height)) * frame.zoom
    const width = bitmap.width * scale; const height = bitmap.height * scale
    context.drawImage(bitmap, (768 - width) / 2 + 768 * frame.x / 100, (768 - height) / 2 + 768 * frame.y / 100, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
    if (!blob || blob.type !== 'image/webp') throw new Error('Não foi possível guardar o enquadramento neste browser.')
    return blob
  } finally { bitmap.close() }
}

export async function removeOldBrandImage(path: string | null | undefined) {
  if (!path || !imagePath.test(path)) return
  // Only after the new reference is confirmed. An uncertain save must keep the uploaded object.
  try { await getSupabase().storage.from(imageBucket).remove([path]) } catch { /* Retry cleanup separately; the saved profile is already valid. */ }
}
