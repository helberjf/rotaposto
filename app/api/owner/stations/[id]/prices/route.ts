import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'
import { getSql } from '@/lib/db'
import { isOwnerSession } from '@/lib/auth/session'

const priceSchema = z.object({
  fuelType: z.enum(['GASOLINE', 'ETHANOL', 'DIESEL', 'GNV']),
  price: z.coerce.number().positive(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql = getSql()
    const session = await getServerSession(authOptions)
    if (!session || !isOwnerSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = priceSchema.parse(body)

    // Verify station ownership
    const station = await sql`
      SELECT id FROM "Station" WHERE id = ${id} AND "ownerId" = ${session.user.id} LIMIT 1
    `

    if (!station.length) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    // Update or insert fuel price
    const priceId = `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const result = await sql`
      INSERT INTO "FuelPrice" (id, "stationId", "fuelType", price, "updatedAt")
      VALUES (${priceId}, ${id}, ${parsed.fuelType}, ${parsed.price}, NOW())
      ON CONFLICT ("stationId", "fuelType") DO UPDATE
      SET price = ${parsed.price}, "updatedAt" = NOW()
      RETURNING id, "stationId", "fuelType", price, "updatedAt"
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[prices-update] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
