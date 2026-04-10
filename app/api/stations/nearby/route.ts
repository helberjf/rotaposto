import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSql } from '@/lib/db'

const querySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().default(2000), // meters
})

export async function GET(request: NextRequest) {
  try {
    const sql = getSql()
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const radius = searchParams.get('radius') || '2000'

    const parsed = querySchema.parse({ lat, lng, radius })

    // Query stations within radius using PostGIS
    const stations = await sql`
      SELECT 
        s.id, s.name, s.address, s.lat, s.lng, s.brand, s.phone, s.source, s."isVerified",
        ST_Distance(s.location, ST_SetSRID(ST_MakePoint(${parsed.lng}, ${parsed.lat}), 4326)::geography) as distance,
        COALESCE(owner_prices.prices, '[]'::json) as owner_prices,
        COALESCE(community_prices.prices, '[]'::json) as community_prices
      FROM "Station" s
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'fuelType', fp."fuelType",
              'price', fp.price,
              'updatedAt', fp."updatedAt"
            )
            ORDER BY fp."fuelType"
          ),
          '[]'::json
        ) as prices
        FROM "FuelPrice" fp
        WHERE fp."stationId" = s.id
      ) owner_prices ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'fuelType', reports."fuelType",
              'price', reports.price,
              'updatedAt', reports."updatedAt",
              'reportCount', reports."reportCount"
            )
            ORDER BY reports."fuelType"
          ),
          '[]'::json
        ) as prices
        FROM (
          SELECT
            dpr."fuelType",
            ROUND(AVG(dpr.price)::numeric, 2)::double precision as price,
            MAX(dpr."createdAt") as "updatedAt",
            COUNT(*)::int as "reportCount"
          FROM "DriverPriceReport" dpr
          WHERE dpr."stationId" = s.id
            AND dpr."createdAt" > NOW() - INTERVAL '7 days'
          GROUP BY dpr."fuelType"
        ) reports
      ) community_prices ON true
      WHERE ST_DWithin(
        s.location,
        ST_SetSRID(ST_MakePoint(${parsed.lng}, ${parsed.lat}), 4326)::geography,
        ${parsed.radius}
      )
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
