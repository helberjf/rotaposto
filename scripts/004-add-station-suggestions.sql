CREATE TABLE IF NOT EXISTS "StationSuggestion" (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  address           TEXT NOT NULL,
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  brand             TEXT,
  phone             TEXT,
  status            TEXT NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "StationSuggestion_status_idx" ON "StationSuggestion" (status);
