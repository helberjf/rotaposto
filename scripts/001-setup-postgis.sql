-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create geography column for Station table
ALTER TABLE "Station" ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- Update location column from lat/lng
UPDATE "Station" 
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE location IS NULL;

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

-- Create spatial index on location
CREATE INDEX IF NOT EXISTS station_location_idx ON "Station" USING GIST (location);

-- Create index for recent reports
CREATE INDEX IF NOT EXISTS driver_report_recent_idx ON "DriverPriceReport" (station_id, created_at DESC);
