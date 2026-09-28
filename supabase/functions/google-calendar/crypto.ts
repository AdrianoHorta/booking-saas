export const eventScope = 'https://www.googleapis.com/auth/calendar.events'
export const scope = `openid https://www.googleapis.com/auth/calendar.calendarlist.readonly ${eventScope}`
export async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
export function randomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
export async function seal(value: unknown, secret: string) {
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)), 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)))
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(data)))
}
export async function unseal(value: string, secret: string) {
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)), 'AES-GCM', false, ['decrypt'])
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12))
  return JSON.parse(new TextDecoder().decode(data))
}
