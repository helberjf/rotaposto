-- FuelRoute Database Schema
-- This creates the tables needed for the application

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create enums
DO $$ BEGIN
    CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'ETHANOL', 'DIESEL', 'GNV');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "StationSource" AS ENUM ('OWNER', 'DRIVER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create StationOwner table
CREATE TABLE IF NOT EXISTS "StationOwner" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "StationOwner_pkey" PRIMARY KEY ("id")
);

-- Create unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS "StationOwner_email_key" ON "StationOwner"("email");

-- Create Station table
CREATE TABLE IF NOT EXISTS "Station" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "brand" TEXT,
    "phone" TEXT,
    "source" "StationSource" NOT NULL DEFAULT 'OWNER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT,
    "location" geography(Point, 4326),
    
    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- Create indexes for Station
CREATE INDEX IF NOT EXISTS "Station_lat_lng_idx" ON "Station"("lat", "lng");
CREATE INDEX IF NOT EXISTS "Station_location_idx" ON "Station" USING GIST ("location");

-- Create FuelPrice table
CREATE TABLE IF NOT EXISTS "FuelPrice" (
    "id" TEXT NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stationId" TEXT NOT NULL,
    
    CONSTRAINT "FuelPrice_pkey" PRIMARY KEY ("id")
);

-- Create unique index for station + fuel type
CREATE UNIQUE INDEX IF NOT EXISTS "FuelPrice_stationId_fuelType_key" ON "FuelPrice"("stationId", "fuelType");
CREATE INDEX IF NOT EXISTS "FuelPrice_stationId_idx" ON "FuelPrice"("stationId");

-- Create DriverPriceReport table
CREATE TABLE IF NOT EXISTS "DriverPriceReport" (
    "id" TEXT NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "reporterHash" TEXT NOT NULL,
    "reporterLat" DOUBLE PRECISION NOT NULL,
    "reporterLng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stationId" TEXT NOT NULL,
    
    CONSTRAINT "DriverPriceReport_pkey" PRIMARY KEY ("id")
);

-- Create indexes for DriverPriceReport
CREATE INDEX IF NOT EXISTS "DriverPriceReport_stationId_createdAt_idx" ON "DriverPriceReport"("stationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DriverPriceReport_reporterHash_idx" ON "DriverPriceReport"("reporterHash");

-- Add foreign key constraints
ALTER TABLE "Station" DROP CONSTRAINT IF EXISTS "Station_ownerId_fkey";
ALTER TABLE "Station" ADD CONSTRAINT "Station_ownerId_fkey" 
    FOREIGN KEY ("ownerId") REFERENCES "StationOwner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FuelPrice" DROP CONSTRAINT IF EXISTS "FuelPrice_stationId_fkey";
ALTER TABLE "FuelPrice" ADD CONSTRAINT "FuelPrice_stationId_fkey" 
    FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DriverPriceReport" DROP CONSTRAINT IF EXISTS "DriverPriceReport_stationId_fkey";
ALTER TABLE "DriverPriceReport" ADD CONSTRAINT "DriverPriceReport_stationId_fkey" 
    FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create trigger to auto-update location on insert/update
CREATE OR REPLACE FUNCTION update_station_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS station_location_trigger ON "Station";

CREATE TRIGGER station_location_trigger
BEFORE INSERT OR UPDATE OF lat, lng ON "Station"
FOR EACH ROW
EXECUTE FUNCTION update_station_location();
