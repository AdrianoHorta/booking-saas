export function parseSupabaseEnv(url: unknown, key: unknown) {
  if (typeof url !== 'string' || typeof key !== 'string') return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.pathname !== '/' || parsed.search || parsed.hash ||
        !key.startsWith('sb_publishable_') || key.trim() !== key) return null
    return { url: parsed.origin, key }
  } catch {
    return null
  }
}

export const supabaseEnv = parseSupabaseEnv(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
