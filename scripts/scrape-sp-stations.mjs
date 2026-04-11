/**
 * Scraper: Gas stations in São Paulo (city), SP
 * Usage:  node scripts/scrape-sp-stations.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client, neonConfig } from '@neondatabase/serverless'
import crypto from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
loadEnvFile(path.join(projectRoot, '.env'))

const OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

// São Paulo city split into 9 sub-regions (3×3 grid) to avoid Overpass 504 timeout
// south, west, north, east  — lat range -23.78→-23.35 (0.43), lng range -46.83→-46.37 (0.46)
const LAT_STEPS = [-23.78, -23.637, -23.493, -23.35]
const LNG_STEPS = [-46.83,  -46.677, -46.523, -46.37]
const QUADRANTS = []
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    QUADRANTS.push(`${LAT_STEPS[r]},${LNG_STEPS[c]},${LAT_STEPS[r + 1]},${LNG_STEPS[c + 1]}`)
  }
}

function buildQuery(bbox) {
  return `
[out:json][timeout:60];
(
  node["amenity"="fuel"](${bbox});
  way["amenity"="fuel"](${bbox});
);
out center tags;
`
}

main().catch((e) => { console.error('Fatal:', e?.stack || String(e)); process.exit(1) })

async function main() {
  console.log('1/4  Fetching stations from Overpass API (4 quadrants) …')
  const seen = new Set()
  const allElements = []

  for (let i = 0; i < QUADRANTS.length; i++) {
    console.log(`     Sub-region ${i + 1}/${QUADRANTS.length}: ${QUADRANTS[i]}`)
    if (i > 0) await new Promise((r) => setTimeout(r, 4000))
    const raw = await fetchOverpass(buildQuery(QUADRANTS[i]))
    for (const el of raw.elements ?? []) {
      const key = `${el.type}-${el.id}`
      if (!seen.has(key)) {
        seen.add(key)
        allElements.push(el)
      }
    }
  }

  console.log(`     ${allElements.length} unique elements returned across ${QUADRANTS.length} sub-regions`)
  if (allElements.length === 0) { console.log('No stations found. Exiting.'); return }

  const stations = allElements.map(normalizeElement).filter(Boolean)
  console.log(`2/4  ${stations.length} valid stations parsed`)

  console.log('3/4  Connecting to database …')
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL is not configured in .env')

  neonConfig.webSocketConstructor = WebSocket
  const client = new Client({ connectionString: dbUrl })
  await client.connect()

  try {
    let inserted = 0, skipped = 0
    for (const station of stations) {
      const r = await upsertStation(client, station)
      if (r === 'inserted') inserted++; else skipped++
    }
    await client.query(`
      UPDATE "Station"
      SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
      WHERE location IS NULL;
    `)
    console.log(`4/4  Done — ${inserted} inserted, ${skipped} already existed`)
    const count = await client.query(
      `SELECT COUNT(*)::int AS total FROM "Station" WHERE address ILIKE '%São Paulo%'`
    )
    console.log(`     Total SP stations in DB: ${count.rows[0].total}`)
  } finally {
    await client.end()
  }
}

async function fetchOverpass(query) {
  let lastError
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Rotaposto/1.0 (github.com/helberjf/rotaposto)',
        },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Overpass API error ${response.status}: ${text.slice(0, 300)}`)
      }
      return response.json()
    } catch (e) {
      console.warn(`     Mirror ${url} failed: ${e.message.slice(0, 80)}. Trying next…`)
      lastError = e
    }
  }
  throw lastError
}

function normalizeElement(el) {
  const tags = el.tags ?? {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (lat == null || lng == null) return null

  const name = tags.name || tags['name:pt'] || tags.brand || 'Posto sem nome'
  const brand = tags.brand || tags.operator || null
  const phone = tags.phone || tags['contact:phone'] || null
  const city = tags['addr:city'] || 'São Paulo'
  const state = tags['addr:state'] || 'SP'

  const addressParts = [
    tags['addr:street'],
    tags['addr:housenumber'] ? `nº ${tags['addr:housenumber']}` : null,
    tags['addr:suburb'] || tags['addr:neighbourhood'],
    city, state,
  ].filter(Boolean)

  const address = addressParts.length > 2 ? addressParts.join(', ') : `${name} - ${city}, ${state}`

  const osmId = `osm-fuel-${el.type}-${el.id}`
  const id = `sp-${crypto.createHash('md5').update(osmId).digest('hex').slice(0, 16)}`
  return { id, name, address, lat, lng, brand, phone }
}

async function upsertStation(client, station) {
  const result = await client.query(
    `INSERT INTO "Station" (id, name, address, lat, lng, brand, phone, source, "isVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRIVER', false, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [station.id, station.name, station.address, station.lat, station.lng, station.brand, station.phone]
  )
  return result.rowCount > 0 ? 'inserted' : 'skipped'
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const envText = fs.readFileSync(filePath, 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const sep = trimmed.indexOf('=')
    if (sep === -1) continue
    const key = trimmed.slice(0, sep).trim()
    const value = trimmed.slice(sep + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}
