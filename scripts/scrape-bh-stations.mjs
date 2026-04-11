/**
 * Scraper: Gas stations in Belo Horizonte (and metro area), MG
 * Usage:  node scripts/scrape-bh-stations.mjs
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

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Bounding box for BH metro area (Contagem, Betim, BH, Nova Lima, Sabará)
// south, west, north, east
const BBOX = '-20.07,-44.20,-19.73,-43.81'

const OVERPASS_QUERY = `
[out:json][timeout:60];
(
  node["amenity"="fuel"](${BBOX});
  way["amenity"="fuel"](${BBOX});
);
out center tags;
`

main().catch((e) => { console.error('Fatal:', e?.stack || String(e)); process.exit(1) })

async function main() {
  console.log('1/4  Fetching stations from Overpass API …')
  const raw = await fetchOverpass()
  const elements = raw.elements ?? []
  console.log(`     ${elements.length} elements returned`)
  if (elements.length === 0) { console.log('No stations found. Exiting.'); return }

  const stations = elements.map(normalizeElement).filter(Boolean)
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
      `SELECT COUNT(*)::int AS total FROM "Station" WHERE address ILIKE '%Belo Horizonte%'`
    )
    console.log(`     Total BH stations in DB: ${count.rows[0].total}`)
  } finally {
    await client.end()
  }
}

async function fetchOverpass() {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Overpass API error ${response.status}: ${text.slice(0, 300)}`)
  }
  return response.json()
}

function normalizeElement(el) {
  const tags = el.tags ?? {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (lat == null || lng == null) return null

  const name = tags.name || tags['name:pt'] || tags.brand || 'Posto sem nome'
  const brand = tags.brand || tags.operator || null
  const phone = tags.phone || tags['contact:phone'] || null
  const city = tags['addr:city'] || 'Belo Horizonte'
  const state = tags['addr:state'] || 'MG'

  const addressParts = [
    tags['addr:street'],
    tags['addr:housenumber'] ? `nº ${tags['addr:housenumber']}` : null,
    tags['addr:suburb'] || tags['addr:neighbourhood'],
    city, state,
  ].filter(Boolean)

  const address = addressParts.length > 2 ? addressParts.join(', ') : `${name} - ${city}, ${state}`

  const osmId = `osm-fuel-${el.type}-${el.id}`
  const id = `bh-${crypto.createHash('md5').update(osmId).digest('hex').slice(0, 16)}`
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
