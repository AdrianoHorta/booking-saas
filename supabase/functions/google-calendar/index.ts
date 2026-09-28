// Google Calendar temporariamente desativado para o lançamento.
// Para reativar, remover a resposta 503 abaixo e descomentar a implementação original.
// import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
// import { createCalendarHandler } from './handler.ts'
// Deno.serve(createCalendarHandler((name) => Deno.env.get(name), createClient))
Deno.serve(() => Response.json(
  { error: 'A integração Google Calendar está temporariamente desativada.' },
  { status: 503, headers: { 'Cache-Control': 'no-store' } },
))
