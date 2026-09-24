import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { createCalendarHandler } from './handler.ts'
Deno.serve(createCalendarHandler((name) => Deno.env.get(name), createClient))
