import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSql } from '@/lib/db'

const querySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().default(5000), // meters
})

export async function GET(request: NextRequest) {
  try {
    const sql = getSql()
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const radius = searchParams.get('radius') || '5000'

    const parsed = querySchema.parse({ lat, lng, radius })

    // Query stations within radius using PostGIS
    const stations = await sql`
      SELECT 
        s.id, s.name, s.address, s.lat, s.lng, s.brand, s.phone, s.source, s."isVerified",
        ST_Distance(s.location, ST_SetSRID(ST_MakePoint(${parsed.lng}, ${parsed.lat}), 4326)::geography) as distance,
        COALESCE(json_agg(
          json_build_object(
            'fuelType', fp."fuelType",
            'price', fp.price,
            'updatedAt', fp."updatedAt"
          ) ORDER BY fp."fuelType"
        ) FILTER (WHERE fp.id IS NOT NULL), '[]'::json) as fuel_prices
      FROM "Station" s
      LEFT JOIN "FuelPrice" fp ON s.id = fp."stationId"
      WHERE ST_DWithin(
        s.location,
        ST_SetSRID(ST_MakePoint(${parsed.lng}, ${parsed.lat}), 4326)::geography,
        ${parsed.radius}
      )
      GROUP BY s.id
      ORDER BY distance ASC
      LIMIT 50
    `

    return NextResponse.json(stations)
  } catch (error) {
    console.error('[nearby] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
