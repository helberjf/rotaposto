import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSql } from '@/lib/db'

const schema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().default(200),
})

export async function GET(request: NextRequest) {
  try {
    const sql = getSql()
    const { searchParams } = new URL(request.url)
    const parsed = schema.parse({
      lat: searchParams.get('lat'),
      lng: searchParams.get('lng'),
      radius: searchParams.get('radius'),
    })

    const stations = await sql`
      SELECT
        id,
        name,
        address,
        brand,
        ROUND(
          ST_Distance(
            location,
            ST_SetSRID(ST_MakePoint(${parsed.lng}, ${parsed.lat}), 4326)::geography
          )::numeric
        ) AS distance
      FROM "Station"
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${parsed.lng}, ${parsed.lat}), 4326)::geography,
        ${parsed.radius}
      )
      ORDER BY distance ASC
      LIMIT 5
    `

    return NextResponse.json(stations)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    }
    console.error('[suggest-check] Error:', error)
    return NextResponse.json([])
  }
}
