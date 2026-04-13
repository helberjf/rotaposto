import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client, neonConfig } from '@neondatabase/serverless'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = path.dirname(currentFilePath)
const projectRoot = path.resolve(currentDirPath, '..')
const envPath = path.join(projectRoot, '.env')

loadEnvFile(envPath)

const schemaStatements = [
  `CREATE EXTENSION IF NOT EXISTS postgis;`,
  `DO $$ BEGIN CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'ETHANOL', 'DIESEL', 'GNV'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "StationSource" AS ENUM ('OWNER', 'DRIVER'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "OwnerRole" AS ENUM ('OWNER', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "OwnerAccountStatus" AS ENUM ('PENDING_EMAIL_VERIFICATION', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'BLOCKED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE TABLE IF NOT EXISTS "StationOwner" ("id" TEXT NOT NULL, "email" TEXT NOT NULL, "password" TEXT NOT NULL, "name" TEXT NOT NULL, "cnpj" TEXT, "phone" TEXT, "role" "OwnerRole" NOT NULL DEFAULT 'OWNER', "status" "OwnerAccountStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION', "emailVerifiedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3), "approvedByEmail" TEXT, "rejectionReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "StationOwner_pkey" PRIMARY KEY ("id"));`,
  `ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "cnpj" TEXT;`,
  `ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "phone" TEXT;`,
  `ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "role" "OwnerRole" NOT NULL DEFAULT 'OWNER';`,
  `ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "status" "OwnerAccountStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION';`,
  `ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);`,
  `ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);`,
  `ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "approvedByEmail" TEXT;`,
  `ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StationOwner_email_key" ON "StationOwner"("email");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StationOwner_cnpj_key" ON "StationOwner"("cnpj") WHERE "cnpj" IS NOT NULL;`,
  `CREATE TABLE IF NOT EXISTS "Station" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "cnpj" TEXT, "address" TEXT NOT NULL, "lat" DOUBLE PRECISION NOT NULL, "lng" DOUBLE PRECISION NOT NULL, "brand" TEXT, "phone" TEXT, "source" "StationSource" NOT NULL DEFAULT 'OWNER', "isVerified" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "ownerId" TEXT, "location" geography(Point, 4326), CONSTRAINT "Station_pkey" PRIMARY KEY ("id"));`,
  `CREATE INDEX IF NOT EXISTS "Station_lat_lng_idx" ON "Station"("lat", "lng");`,
  `CREATE INDEX IF NOT EXISTS "Station_location_idx" ON "Station" USING GIST ("location");`,
  `CREATE TABLE IF NOT EXISTS "FuelPrice" ("id" TEXT NOT NULL, "fuelType" "FuelType" NOT NULL, "price" DOUBLE PRECISION NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "stationId" TEXT NOT NULL, CONSTRAINT "FuelPrice_pkey" PRIMARY KEY ("id"));`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FuelPrice_stationId_fuelType_key" ON "FuelPrice"("stationId", "fuelType");`,
  `CREATE INDEX IF NOT EXISTS "FuelPrice_stationId_idx" ON "FuelPrice"("stationId");`,
  `CREATE TABLE IF NOT EXISTS "DriverPriceReport" ("id" TEXT NOT NULL, "fuelType" "FuelType" NOT NULL, "price" DOUBLE PRECISION NOT NULL, "reporterHash" TEXT NOT NULL, "reporterLat" DOUBLE PRECISION NOT NULL, "reporterLng" DOUBLE PRECISION NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "stationId" TEXT NOT NULL, CONSTRAINT "DriverPriceReport_pkey" PRIMARY KEY ("id"));`,
  `CREATE INDEX IF NOT EXISTS "DriverPriceReport_stationId_createdAt_idx" ON "DriverPriceReport"("stationId", "createdAt" DESC);`,
  `CREATE INDEX IF NOT EXISTS "DriverPriceReport_reporterHash_idx" ON "DriverPriceReport"("reporterHash");`,
  `CREATE TABLE IF NOT EXISTS "AuthToken" ("id" TEXT NOT NULL, "email" TEXT NOT NULL, "type" "AuthTokenType" NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "ownerId" TEXT, CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id"));`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");`,
  `CREATE INDEX IF NOT EXISTS "AuthToken_email_type_idx" ON "AuthToken"("email", "type");`,
  `CREATE INDEX IF NOT EXISTS "AuthToken_ownerId_idx" ON "AuthToken"("ownerId");`,
  `ALTER TABLE "Station" DROP CONSTRAINT IF EXISTS "Station_ownerId_fkey";`,
  `ALTER TABLE "Station" ADD CONSTRAINT "Station_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "StationOwner"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "FuelPrice" DROP CONSTRAINT IF EXISTS "FuelPrice_stationId_fkey";`,
  `ALTER TABLE "FuelPrice" ADD CONSTRAINT "FuelPrice_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "DriverPriceReport" DROP CONSTRAINT IF EXISTS "DriverPriceReport_stationId_fkey";`,
  `ALTER TABLE "DriverPriceReport" ADD CONSTRAINT "DriverPriceReport_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "AuthToken" DROP CONSTRAINT IF EXISTS "AuthToken_ownerId_fkey";`,
  `ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "StationOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `CREATE OR REPLACE FUNCTION update_station_location() RETURNS TRIGGER AS $$ BEGIN NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography; RETURN NEW; END; $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS station_location_trigger ON "Station";`,
  `CREATE TRIGGER station_location_trigger BEFORE INSERT OR UPDATE OF lat, lng ON "Station" FOR EACH ROW EXECUTE FUNCTION update_station_location();`,
]

const seedStatements = [
  `INSERT INTO "StationOwner" (id, email, password, name, cnpj, phone, role, status, "emailVerifiedAt", "approvedAt", "approvedByEmail", "createdAt", "updatedAt") VALUES ('owner1', 'joao@posto.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Joao Silva', '12345678000190', '11999990001', 'OWNER', 'ACTIVE', NOW(), NOW(), 'admin@rotaposto.com', NOW(), NOW()), ('owner2', 'maria@posto.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Maria Santos', '98765432000110', '11999990002', 'OWNER', 'ACTIVE', NOW(), NOW(), 'admin@rotaposto.com', NOW(), NOW()), ('admin1', 'admin@rotaposto.com', '$2b$10$RrVh5aorjiqfr4cBSsCe5em/oYGT8QwpRRF2f6wDe57IKQvkyhKyK', 'Admin Rotaposto', '11111111000191', '11999990099', 'ADMIN', 'ACTIVE', NOW(), NOW(), 'system', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
  `INSERT INTO "Station" (id, name, cnpj, address, lat, lng, brand, phone, source, "isVerified", "ownerId", "createdAt", "updatedAt") VALUES ('station1', 'Posto Shell Paulista', '12.345.678/0001-90', 'Av. Paulista, 1000 - Bela Vista, Sao Paulo', -23.5629, -46.6544, 'Shell', '(11) 3251-0000', 'OWNER', true, 'owner1', NOW(), NOW()), ('station2', 'Posto Ipiranga Centro', '98.765.432/0001-10', 'R. da Consolacao, 500 - Consolacao, Sao Paulo', -23.5505, -46.6580, 'Ipiranga', '(11) 3259-0000', 'OWNER', true, 'owner1', NOW(), NOW()), ('station3', 'Auto Posto BR Vila Mariana', '11.222.333/0001-44', 'Av. Domingos de Morais, 800 - Vila Mariana, Sao Paulo', -23.5912, -46.6367, 'BR', '(11) 5571-0000', 'OWNER', true, 'owner2', NOW(), NOW()), ('station4', 'Posto Petrobras Pinheiros', '55.666.777/0001-88', 'R. dos Pinheiros, 1500 - Pinheiros, Sao Paulo', -23.5670, -46.6870, 'Petrobras', '(11) 3032-0000', 'OWNER', true, 'owner2', NOW(), NOW()), ('station5', 'Posto Ale Moema', '44.555.666/0001-22', 'Av. Ibirapuera, 3000 - Moema, Sao Paulo', -23.6010, -46.6650, 'Ale', '(11) 5051-0000', 'OWNER', true, 'owner2', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
  `INSERT INTO "Station" (id, name, address, lat, lng, brand, source, "isVerified", "createdAt", "updatedAt") VALUES ('station6', 'Posto Bom Preco', 'R. Augusta, 2000 - Jardins, Sao Paulo', -23.5550, -46.6620, 'Bandeira Branca', 'DRIVER', false, NOW(), NOW()), ('station7', 'Auto Posto Economia', 'Av. Reboucas, 1200 - Pinheiros, Sao Paulo', -23.5610, -46.6780, NULL, 'DRIVER', false, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;`,
  `INSERT INTO "FuelPrice" (id, "fuelType", price, "stationId", "updatedAt") VALUES ('price1a', 'GASOLINE', 5.89, 'station1', NOW() - INTERVAL '2 hours'), ('price1b', 'ETHANOL', 3.99, 'station1', NOW() - INTERVAL '2 hours'), ('price1c', 'DIESEL', 5.49, 'station1', NOW() - INTERVAL '2 hours'), ('price2a', 'GASOLINE', 5.79, 'station2', NOW() - INTERVAL '12 hours'), ('price2b', 'ETHANOL', 3.89, 'station2', NOW() - INTERVAL '12 hours'), ('price3a', 'GASOLINE', 5.95, 'station3', NOW() - INTERVAL '36 hours'), ('price3b', 'ETHANOL', 4.05, 'station3', NOW() - INTERVAL '36 hours'), ('price3c', 'DIESEL', 5.59, 'station3', NOW() - INTERVAL '36 hours'), ('price3d', 'GNV', 4.19, 'station3', NOW() - INTERVAL '36 hours'), ('price4a', 'GASOLINE', 5.69, 'station4', NOW() - INTERVAL '80 hours'), ('price4b', 'ETHANOL', 3.79, 'station4', NOW() - INTERVAL '80 hours'), ('price5a', 'GASOLINE', 5.75, 'station5', NOW() - INTERVAL '5 hours'), ('price5b', 'ETHANOL', 3.85, 'station5', NOW() - INTERVAL '5 hours'), ('price5c', 'DIESEL', 5.39, 'station5', NOW() - INTERVAL '5 hours') ON CONFLICT (id) DO NOTHING;`,
  `INSERT INTO "DriverPriceReport" (id, "fuelType", price, "reporterHash", "reporterLat", "reporterLng", "stationId", "createdAt") VALUES ('report1a', 'GASOLINE', 5.85, 'hash_user_001', -23.5630, -46.6545, 'station1', NOW() - INTERVAL '30 minutes'), ('report1b', 'ETHANOL', 3.95, 'hash_user_002', -23.5631, -46.6543, 'station1', NOW() - INTERVAL '1 hour'), ('report2a', 'GASOLINE', 5.82, 'hash_user_003', -23.5506, -46.6581, 'station2', NOW() - INTERVAL '4 hours'), ('report3a', 'GASOLINE', 5.90, 'hash_user_004', -23.5913, -46.6368, 'station3', NOW() - INTERVAL '2 days'), ('report3b', 'DIESEL', 5.55, 'hash_user_005', -23.5911, -46.6366, 'station3', NOW() - INTERVAL '1 day'), ('report6a', 'GASOLINE', 5.65, 'hash_user_006', -23.5551, -46.6621, 'station6', NOW() - INTERVAL '6 hours'), ('report6b', 'ETHANOL', 3.75, 'hash_user_007', -23.5549, -46.6619, 'station6', NOW() - INTERVAL '3 hours') ON CONFLICT (id) DO NOTHING;`,
  `UPDATE "Station" SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography WHERE location IS NULL;`,
]

main().catch((error) => {
  console.error(error?.stack || String(error))
  process.exit(1)
})

async function main() {
  if (!process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED must be configured in .env')
  }

  neonConfig.webSocketConstructor = WebSocket

  const client = new Client({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  })

  await client.connect()

  try {
    await runStatements(client, schemaStatements, 'schema')
    await runStatements(client, seedStatements, 'seed')

    const counts = await client.query(
      'SELECT (SELECT COUNT(*)::int FROM "Station") AS stations, (SELECT COUNT(*)::int FROM "FuelPrice") AS fuel_prices, (SELECT COUNT(*)::int FROM "DriverPriceReport") AS reports, (SELECT COUNT(*)::int FROM "StationOwner") AS owners'
    )

    console.log('Initialization complete')
    console.log(JSON.stringify(counts.rows[0], null, 2))
  } finally {
    await client.end()
  }
}

async function runStatements(client, statements, label) {
  for (let index = 0; index < statements.length; index += 1) {
    await client.query(statements[index])
    console.log(`${label} ${index + 1}/${statements.length}`)
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const envText = fs.readFileSync(filePath, 'utf8')

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}
