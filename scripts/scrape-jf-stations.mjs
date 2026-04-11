/**
 * Scraper: Gas stations in Juiz de Fora, MG
 *
 * Uses the OpenStreetMap Overpass API to fetch every amenity=fuel
 * inside the Juiz de Fora administrative boundary and upserts them
 * into the Rotaposto database.
 *
 * Usage:  node scripts/scrape-jf-stations.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client, neonConfig } from '@neondatabase/serverless'
import crypto from 'node:crypto'

// ── helpers ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

loadEnvFile(path.join(projectRoot, '.env'))

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Bounding box for Juiz de Fora, MG (south, west, north, east)
const JF_BBOX = '-21.84,-43.44,-21.59,-43.24'

// Overpass QL: find fuel stations in the Juiz de Fora bounding box
const OVERPASS_QUERY = `
[out:json][timeout:60];
(
  node["amenity"="fuel"](${JF_BBOX});
  way["amenity"="fuel"](${JF_BBOX});
);
out center tags;
`

// ── main ─────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal:', error?.stack || String(error))
  process.exit(1)
})

async function main() {
  console.log('1/4  Fetching stations from Overpass API …')
  const raw = await fetchOverpass()
  const elements = raw.elements ?? []
  console.log(`     ${elements.length} elements returned`)

  if (elements.length === 0) {
    console.log('No stations found. Exiting.')
    return
  }

  const stations = elements
    .map(normalizeElement)
    .filter((s) => s !== null)

  console.log(`2/4  ${stations.length} valid stations parsed`)

  console.log('3/4  Connecting to database …')
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not configured in .env')
  }

  neonConfig.webSocketConstructor = WebSocket
  const client = new Client({ connectionString: dbUrl })
  await client.connect()

  try {
    let inserted = 0
    let skipped = 0

    for (const station of stations) {
      const result = await upsertStation(client, station)
      if (result === 'inserted') inserted++
      else skipped++
    }

    // make sure the location geography column is populated
    await client.query(`
      UPDATE "Station"
      SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
      WHERE location IS NULL;
    `)

    console.log(`4/4  Done — ${inserted} inserted, ${skipped} already existed`)

    const count = await client.query(
      `SELECT COUNT(*)::int AS total FROM "Station" WHERE address ILIKE '%Juiz de Fora%'`
    )
    console.log(`     Total JF stations in DB: ${count.rows[0].total}`)
  } finally {
    await client.end()
  }
}

// ── Overpass fetch ───────────────────────────────────────────────────

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

// ── Normalize an Overpass element to our Station shape ───────────────

function normalizeElement(el) {
  const tags = el.tags ?? {}

  // For ways/relations, use center coordinates
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon

  if (lat == null || lng == null) return null

  const name = tags.name || tags['name:pt'] || tags.brand || 'Posto sem nome'
  const brand = tags.brand || tags.operator || null
  const phone = tags.phone || tags['contact:phone'] || null

  // Build a human-readable address from OSM tags
  const addressParts = [
    tags['addr:street'],
    tags['addr:housenumber'] ? `nº ${tags['addr:housenumber']}` : null,
    tags['addr:suburb'] || tags['addr:neighbourhood'],
    'Juiz de Fora',
    'MG',
  ].filter(Boolean)

  const address =
    addressParts.length > 2
      ? addressParts.join(', ')
      : `${name} - Juiz de Fora, MG`

  // Deterministic ID based on OSM id so re-runs don't duplicate
  const osmId = `osm-fuel-${el.type}-${el.id}`
  const id = `jf-${crypto.createHash('md5').update(osmId).digest('hex').slice(0, 16)}`

  return { id, name, address, lat, lng, brand, phone }
}

// ── Upsert into database ────────────────────────────────────────────

async function upsertStation(client, station) {
  const result = await client.query(
    `INSERT INTO "Station" (id, name, address, lat, lng, brand, phone, source, "isVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRIVER', false, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      station.id,
      station.name,
      station.address,
      station.lat,
      station.lng,
      station.brand,
      station.phone,
    ]
  )

  return result.rowCount > 0 ? 'inserted' : 'skipped'
}

// ── .env loader (same as init-neon-db.mjs) ──────────────────────────

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
