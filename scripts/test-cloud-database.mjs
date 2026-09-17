import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const projectRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
if (projectRef !== 'ztldgxngubtprderwssw') {
  throw new Error('Os testes cloud estão limitados ao projeto booking-saas-dev.')
}

const testDirectory = 'supabase/tests/database'
const testFiles = process.argv[2] ? [process.argv[2]] : readdirSync(testDirectory)
  .filter((name) => name.endsWith('.test.sql')).sort().map((name) => testDirectory + '/' + name)
if (!testFiles.length) throw new Error('Não foram encontrados testes SQL.')
const cli = require.resolve('supabase/dist/supabase.js')
for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, [
    cli, 'db', 'query', '--linked', '--file', testFile,
  ], {
    encoding: 'utf8',
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
  })
  
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout)
    process.exit(1)
  }
  
  // A API devolve o último resultado: finish() inclui o plano e diagnósticos de falha.
  const response = JSON.parse(result.stdout)
  const rows = response.rows
  if (!Array.isArray(rows) || rows.length !== 1 ||
      typeof rows[0]?.finish !== 'string' || !/^1\.\.[1-9]\d*$/.test(rows[0].finish)) {
    console.error('A suite SQL falhou ou devolveu um resultado inesperado:', rows)
    process.exit(1)
  }
  
  console.log(`${rows[0].finish.slice(3)} testes SQL passaram em booking-saas-dev (rollback).`)
}
