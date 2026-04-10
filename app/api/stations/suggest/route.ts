import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSql } from '@/lib/db'

const stationSuggestionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(240),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  brand: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const sql = getSql()
    const body = await request.json()
    const parsed = stationSuggestionSchema.parse(body)

    const duplicate = await sql`
      SELECT id
      FROM "Station"
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${parsed.lng}, ${parsed.lat}), 4326)::geography,
        120
      )
      AND LOWER(name) = LOWER(${parsed.name})
      LIMIT 1
    `

    if (duplicate.length > 0) {
      return NextResponse.json(
        { error: 'Já existe um posto parecido cadastrado nessa região.' },
        { status: 409 }
      )
    }

    const id = `station_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

    const station = await sql`
      INSERT INTO "Station" (
        id, name, address, lat, lng, brand, phone, source, "isVerified", "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${parsed.name}, ${parsed.address}, ${parsed.lat}, ${parsed.lng},
        ${parsed.brand || null}, ${parsed.phone || null}, 'DRIVER', false, NOW(), NOW()
      )
      RETURNING id, name, address, lat, lng, brand, phone, source, "isVerified"
    `

    return NextResponse.json(
      {
        success: true,
        station: {
          ...station[0],
          fuel_prices: [],
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[stations-suggest] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Preencha os dados do posto corretamente.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Não foi possível salvar a sugestão agora.' },
      { status: 500 }
    )
  }
}
