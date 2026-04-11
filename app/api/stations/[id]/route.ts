import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql = getSql()

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
      WHERE s.id = ${id}
      LIMIT 1
    `

    if (!stations.length) {
      return NextResponse.json({ error: 'Posto não encontrado.' }, { status: 404 })
    }

    return NextResponse.json(stations[0])
  } catch (error) {
    console.error('[station-by-id] Error:', error)
    return NextResponse.json(
      { error: 'Não foi possível atualizar o posto.' },
      { status: 500 }
    )
  }
}
