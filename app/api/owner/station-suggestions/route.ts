import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getSql } from '@/lib/db'
import { isAdminSession } from '@/lib/auth/session'
import { z } from 'zod'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sql = getSql()
  const suggestions = await sql`
    SELECT
      id, name, address, lat, lng, brand, phone, status,
      "rejectionReason", "createdAt"
    FROM "StationSuggestion"
    ORDER BY
      CASE status WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,
      "createdAt" DESC
    LIMIT 100
  `
  return NextResponse.json(suggestions)
}

const actionSchema = z.object({
  id: z.string(),
  action: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().max(200).optional(),
})

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sql = getSql()
  const body = await request.json()
  const { id, action, rejectionReason } = actionSchema.parse(body)

  if (action === 'APPROVED') {
    const rows = await sql`SELECT * FROM "StationSuggestion" WHERE id = ${id}`
    const sug = rows[0]
    if (!sug) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const stationId = `station_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    await sql`
      INSERT INTO "Station"
        (id, name, address, lat, lng, brand, phone, source, "isVerified", "createdAt", "updatedAt")
      VALUES
        (${stationId}, ${sug.name}, ${sug.address}, ${sug.lat}, ${sug.lng},
         ${sug.brand ?? null}, ${sug.phone ?? null}, 'DRIVER', false, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `
    // location column is populated by the DB trigger on INSERT
  }

  await sql`
    UPDATE "StationSuggestion"
    SET
      status = ${action},
      "rejectionReason" = ${rejectionReason ?? null},
      "updatedAt" = NOW()
    WHERE id = ${id}
  `

  return NextResponse.json({ success: true })
}
