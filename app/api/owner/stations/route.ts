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

export async function GET(request: NextRequest) {
  try {
    const sql = getSql()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stations = await sql`
      SELECT id, name, cnpj, address, lat, lng, brand, phone, source, "isVerified", "createdAt", "updatedAt"
      FROM "Station"
      WHERE "ownerId" = ${session.user.id}
      ORDER BY "createdAt" DESC
    `

    return NextResponse.json(stations)
  } catch (error) {
    console.error('[owner-stations] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = getSql()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = stationSchema.parse(body)

    const id = `station_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const station = await sql`
      INSERT INTO "Station" (
        id, name, cnpj, address, lat, lng, brand, phone, source, "ownerId", "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${parsed.name}, ${parsed.cnpj || null}, ${parsed.address},
        ${parsed.lat}, ${parsed.lng}, ${parsed.brand || null}, ${parsed.phone || null},
        'OWNER', ${session.user.id}, NOW(), NOW()
      )
      RETURNING id, name, cnpj, address, lat, lng, brand, phone, source, "isVerified", "createdAt", "updatedAt"
    `

    return NextResponse.json(station[0], { status: 201 })
  } catch (error) {
    console.error('[owner-stations] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
