import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { z } from 'zod'
import { getSql } from '@/lib/db'

const stationSchema = z.object({
  name: z.string().min(2),
  cnpj: z.string().optional(),
  address: z.string().min(5),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  brand: z.string().optional(),
  phone: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql = getSql()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const station = await sql`
      SELECT s.id, s.name, s.cnpj, s.address, s.lat, s.lng, s.brand, s.phone, s.source, s."isVerified", s."createdAt", s."updatedAt",
             COALESCE(json_agg(
               json_build_object('fuelType', fp."fuelType", 'price', fp.price, 'updatedAt', fp."updatedAt")
               ORDER BY fp."fuelType"
             ) FILTER (WHERE fp.id IS NOT NULL), '[]'::json) as fuel_prices
      FROM "Station" s
      LEFT JOIN "FuelPrice" fp ON s.id = fp."stationId"
      WHERE s.id = ${id} AND s."ownerId" = ${session.user.id}
      GROUP BY s.id
      LIMIT 1
    `

    if (!station.length) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    return NextResponse.json(station[0])
  } catch (error) {
    console.error('[station-details] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql = getSql()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = stationSchema.parse(body)

    const station = await sql`
      UPDATE "Station"
      SET name = ${parsed.name}, cnpj = ${parsed.cnpj || null}, address = ${parsed.address},
          lat = ${parsed.lat}, lng = ${parsed.lng}, brand = ${parsed.brand || null},
          phone = ${parsed.phone || null}, "updatedAt" = NOW()
      WHERE id = ${id} AND "ownerId" = ${session.user.id}
      RETURNING id, name, cnpj, address, lat, lng, brand, phone, source, "isVerified", "createdAt", "updatedAt"
    `

    if (!station.length) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    return NextResponse.json(station[0])
  } catch (error) {
    console.error('[station-update] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
