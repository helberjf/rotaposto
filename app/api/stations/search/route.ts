import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSql } from '@/lib/db'

const querySchema = z.object({
  q: z.string().max(120).default(''),
  city: z.string().min(2).max(120).optional(),
  neighborhood: z.string().min(2).max(120).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const sql = getSql()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const city = searchParams.get('city') || undefined
    const neighborhood = searchParams.get('neighborhood') || undefined
    const parsed = querySchema.parse({ q, city, neighborhood })

    const term = parsed.q ? `%${parsed.q}%` : '%'
    // When no city is given, '%' matches every address (no-op filter)
    const cityTerm = parsed.city ? `%${parsed.city}%` : '%'
    const neighborhoodTerm = parsed.neighborhood ? `%${parsed.neighborhood}%` : '%'

    const stations = await sql`
      SELECT
        s.id, s.name, s.address, s.lat, s.lng, s.brand, s.phone, s.source, s."isVerified",
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
      WHERE (s.name ILIKE ${term} OR s.address ILIKE ${term})
        AND s.address ILIKE ${cityTerm}
        AND s.address ILIKE ${neighborhoodTerm}
      ORDER BY s.name ASC
      LIMIT 20
    `

    return NextResponse.json(stations)
  } catch (error) {
    console.error('[stations-search] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Informe o nome do posto ou selecione um bairro.' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Não foi possível buscar postos.' },
      { status: 500 }
    )
  }
}
