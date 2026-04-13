DO $$ BEGIN
    CREATE TYPE "OwnerRole" AS ENUM ('OWNER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OwnerAccountStatus" AS ENUM (
        'PENDING_EMAIL_VERIFICATION',
        'PENDING_APPROVAL',
        'ACTIVE',
        'REJECTED',
        'BLOCKED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "cnpj" TEXT;
ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "role" "OwnerRole" NOT NULL DEFAULT 'OWNER';
ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "status" "OwnerAccountStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION';
ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "approvedByEmail" TEXT;
ALTER TABLE "StationOwner" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "StationOwner_cnpj_key" ON "StationOwner"("cnpj") WHERE "cnpj" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "AuthToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "AuthToken_email_type_idx" ON "AuthToken"("email", "type");
CREATE INDEX IF NOT EXISTS "AuthToken_ownerId_idx" ON "AuthToken"("ownerId");

ALTER TABLE "AuthToken" DROP CONSTRAINT IF EXISTS "AuthToken_ownerId_fkey";
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "StationOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "StationOwner"
SET
    "status" = 'ACTIVE',
    "role" = COALESCE("role", 'OWNER'),
    "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW()),
    "approvedAt" = COALESCE("approvedAt", NOW())
WHERE "status" = 'PENDING_EMAIL_VERIFICATION';

INSERT INTO "StationOwner" (
    id, email, password, name, cnpj, phone, role, status,
    "emailVerifiedAt", "approvedAt", "approvedByEmail", "createdAt", "updatedAt"
)
VALUES (
    'admin1',
    'admin@rotaposto.com',
    '$2b$10$RrVh5aorjiqfr4cBSsCe5em/oYGT8QwpRRF2f6wDe57IKQvkyhKyK',
    'Admin Rotaposto',
    '11111111000191',
    '11999990099',
    'ADMIN',
    'ACTIVE',
    NOW(),
    NOW(),
    'system',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;
