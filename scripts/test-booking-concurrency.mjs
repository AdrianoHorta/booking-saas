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
    insert into public.businesses(id,name,slug,timezone,public_booking_enabled) values ('${business}','Concurrency test','${slug}','UTC',true);
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
  console.log('Concorrência validada: uma vaga/um vencedor; retries simultâneos sem duplicação ou clientes órfãos.')
} finally {
  // UUID exclusivo desta execução; nunca apaga fixtures de outra execução.
  try {
    success(await query(`begin;
      delete from public.bookings where business_id='${business}';
      delete from public.customers where business_id='${business}';
      delete from public.businesses where id='${business}' and slug='${slug}';
      commit; select true as cleaned;`))
  } finally {
    files.forEach(file => unlinkSync(file))
    rmdirSync(directory)
  }
}
