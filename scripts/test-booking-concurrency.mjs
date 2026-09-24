import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Fixtures sintéticas e isoladas; nunca executar contra outro projeto.
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'ztldgxngubtprderwssw')
const cli = createRequire(import.meta.url).resolve('supabase/dist/supabase.js')
const directory = mkdtempSync(join(tmpdir(), 'booking-concurrency-'))
const files = []
const business = randomUUID()
const employee = randomUUID()
const service = randomUUID()
const manager = randomUUID()
const slug = `concurrency-${business}`
const start = new Date(Date.now() + 7 * 86400000)
start.setUTCHours(9, 0, 0, 0)

async function query(sql) {
  const file = join(directory, `${files.length}.sql`)
  files.push(file)
  writeFileSync(file, sql)
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'db', 'query', '--linked', '--file', file], {
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' }, windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
}
function success(result) {
  assert.equal(result.code, 0, result.stdout + result.stderr)
  return JSON.parse(result.stdout).rows
}
function request(key, time) {
  // Ambas as transações ficam abertas durante a disputa. O vencedor mantém
  // locks até ao commit; o segundo pedido espera e revalida depois desse commit.
  return query(`begin; set local role anon;
    select public.confirm_booking('${slug}','${employee}','${service}','${time}','${key}','Test client','test@example.test');
    select pg_sleep(2); commit;`)
}
try {
  success(await query(`begin;
    insert into auth.users(id,email) values ('${manager}','concurrency-${manager}@example.test');
    insert into public.businesses(id,name,slug,timezone,public_booking_enabled) values ('${business}','Concurrency test','${slug}','UTC',true);
    insert into public.business_members(business_id,user_id,role) values ('${business}','${manager}','owner');
    insert into public.employees(id,business_id,name) values ('${employee}','${business}','Test professional');
    insert into public.services(id,business_id,name,duration_minutes,price_cents) values ('${service}','${business}','Test service',30,1000);
    insert into public.employee_services(business_id,employee_id,service_id) values ('${business}','${employee}','${service}');
    insert into public.employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute)
      select '${business}','${employee}',d,0,1440 from generate_series(1,7) d;
    commit; select true as ready;`))
  const competing = await Promise.all([request(randomUUID(), start.toISOString()), request(randomUUID(), start.toISOString())])
  assert.equal(competing.filter(result => result.code === 0).length, 1, 'Only one competing booking succeeds')
  const failed = competing.find(result => result.code !== 0)
  assert.match(failed.stdout + failed.stderr, /23P01|bookings_no_overlap/, 'Loser reports an overlap conflict')
  const retryKey = randomUUID()
  start.setUTCHours(10)
  const retries = await Promise.all([request(retryKey, start.toISOString()), request(retryKey, start.toISOString())])
  retries.forEach(success)
  const [counts] = success(await query(`select
    (select count(*)::int from public.bookings where business_id='${business}') as bookings,
    (select count(*)::int from public.customers where business_id='${business}') as customers,
    (select count(*)::int from public.bookings where business_id='${business}' and request_id='${retryKey}') as retries;`))
  assert.deepEqual(counts, { bookings: 2, customers: 2, retries: 1 })
  const originals = success(await query(`select id,starts_at from public.bookings where business_id='${business}' order by starts_at;`))
  start.setUTCHours(11)
  const target = start.toISOString()
  const move = (booking) => query(`begin; set local role authenticated; set local "request.jwt.claim.sub"='${manager}';
    select public.reschedule_booking('${business}','${booking.id}','${booking.starts_at}','${target}');
    select pg_sleep(2); commit;`)
  const moves = await Promise.all(originals.map(move))
  assert.equal(moves.filter(result => result.code === 0).length, 1, 'Only one reschedule takes the target slot')
  const losingIndex = moves.findIndex(result => result.code !== 0)
  assert.match(moves[losingIndex].stdout + moves[losingIndex].stderr, /23P01|bookings_no_overlap/)
  const [preserved] = success(await query(`select starts_at='${originals[losingIndex].starts_at}'::timestamptz as original_preserved
    from public.bookings where id='${originals[losingIndex].id}' and business_id='${business}';`))
  assert.equal(preserved.original_preserved, true, 'Losing reschedule preserves original booking')
  success(await move(originals[1-losingIndex]))
  console.log('Concorrência validada: uma vaga/um vencedor; retries simultâneos sem duplicação ou clientes órfãos.')
  console.log('Reagendamento concorrente validado: um vencedor, horário original do outro preservado e retry seguro.')
} finally {
  // UUID exclusivo desta execução; nunca apaga fixtures de outra execução.
  try {
    success(await query(`begin;
      delete from public.bookings where business_id='${business}';
      delete from public.customers where business_id='${business}';
      delete from public.businesses where id='${business}' and slug='${slug}';
      delete from auth.users where id='${manager}' and email='concurrency-${manager}@example.test';
      commit; select true as cleaned;`))
  } finally {
    files.forEach(file => unlinkSync(file))
    rmdirSync(directory)
  }
}
