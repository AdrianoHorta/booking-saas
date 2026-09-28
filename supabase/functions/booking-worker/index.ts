import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { createWorkerHandler } from './handler.ts'
Deno.serve(createWorkerHandler((key) => Deno.env.get(key), () => {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  const key = keys ? JSON.parse(keys).default : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) throw new Error('configuration')
  return createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false, autoRefreshToken: false } })
}))
