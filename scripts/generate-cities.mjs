/**
 * Fetches all Brazilian municipalities from the IBGE public API and writes
 * a compact JSON to lib/brazil-cities.json for client-side filtering.
 *
 * Run once:  node scripts/generate-cities.mjs
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'lib', 'brazil-cities.json')

const URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'

// IBGE state code (first 2 digits of municipality ID) → UF sigla
const UF_BY_CODE = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
  21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL',
  28: 'SE', 29: 'BA',
  31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP',
  41: 'PR', 42: 'SC', 43: 'RS',
  50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
}

console.log('Fetching municipalities from IBGE…')
const res = await fetch(URL)
if (!res.ok) throw new Error(`IBGE returned ${res.status}`)

const raw = await res.json()

// Compact: [{c: "Juiz de Fora", u: "MG"}, ...]
const cities = raw.map((m) => {
  const stateCode = Math.floor(m.id / 100000)
  return {
    c: m.nome,
    u: m.microrregiao?.mesorregiao?.UF?.sigla ?? UF_BY_CODE[stateCode] ?? '??',
  }
})

writeFileSync(OUT, JSON.stringify(cities), 'utf-8')
console.log(`✓ Wrote ${cities.length} municipalities to lib/brazil-cities.json`)
