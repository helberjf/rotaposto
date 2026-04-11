import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { anonymizeLocation, createReporterHash } from '@/lib/anonymize'
import { getSql } from '@/lib/db'

const reportSchema = z.object({
  stationId: z.string(),
  fuelType: z.enum(['GASOLINE', 'ETHANOL', 'DIESEL', 'GNV']),
  price: z.coerce.number().positive(),
  reporterLat: z.coerce.number(),
  reporterLng: z.coerce.number(),
})

const MAX_COMMUNITY_PRICE_DEVIATION = 0.1
const MAX_REPORTS_PER_HOUR = 3

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = reportSchema.parse(body)
    const sql = getSql()

    const reporterHash = await buildReporterHash(request, parsed)

    // Validate reporter is within 500m of station
    const proximityCheck = await sql`
      SELECT ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${parsed.reporterLng}, ${parsed.reporterLat}), 4326)::geography
      ) AS distance
      FROM "Station"
      WHERE id = ${parsed.stationId}
      LIMIT 1
    `

    if (!proximityCheck.length) {
      return NextResponse.json(
        { error: 'Posto não encontrado.' },
        { status: 404 }
      )
    }

    if (Number(proximityCheck[0].distance) > 500) {
      return NextResponse.json(
        { error: 'Você precisa estar a no máximo 500m do posto para atualizar o preço.' },
        { status: 403 }
      )
    }

    const recentReporterActivity = await sql`
      SELECT COUNT(*)::int as report_count
      FROM "DriverPriceReport"
      WHERE "reporterHash" = ${reporterHash}
        AND "createdAt" > NOW() - INTERVAL '1 hour'
    `

    if (Number(recentReporterActivity[0]?.report_count || 0) >= MAX_REPORTS_PER_HOUR) {
      return NextResponse.json(
        { error: 'Você atingiu o limite de atualizações colaborativas por hora.' },
        { status: 429 }
      )
    }

    const repeatedStationReport = await sql`
      SELECT COUNT(*)::int as report_count
      FROM "DriverPriceReport"
      WHERE "reporterHash" = ${reporterHash}
        AND "stationId" = ${parsed.stationId}
        AND "fuelType" = ${parsed.fuelType}
        AND "createdAt" > NOW() - INTERVAL '1 hour'
    `

    if (Number(repeatedStationReport[0]?.report_count || 0) > 0) {
      return NextResponse.json(
        {
          error:
            'Aguarde um pouco antes de atualizar novamente este combustível neste posto.',
        },
        { status: 429 }
      )
    }

    const currentCommunityPrice = await sql`
      SELECT
        ROUND(AVG(price)::numeric, 2)::double precision as avg_price,
        COUNT(*)::int as report_count
      FROM "DriverPriceReport"
      WHERE "stationId" = ${parsed.stationId}
        AND "fuelType" = ${parsed.fuelType}
        AND "createdAt" > NOW() - INTERVAL '7 days'
    `

    const baselinePrice = Number(currentCommunityPrice[0]?.avg_price)

    let referencePrice =
      Number.isFinite(baselinePrice) && baselinePrice > 0
        ? baselinePrice
        : null

    if (referencePrice === null) {
      const officialPrice = await sql`
        SELECT price
        FROM "FuelPrice"
        WHERE "stationId" = ${parsed.stationId}
          AND "fuelType" = ${parsed.fuelType}
        LIMIT 1
      `

      const ownerBaseline = Number(officialPrice[0]?.price)

      referencePrice =
        Number.isFinite(ownerBaseline) && ownerBaseline > 0
          ? ownerBaseline
          : null
    }

    if (referencePrice !== null) {
      const deviation =
        Math.abs(parsed.price - referencePrice) / referencePrice

      if (deviation > MAX_COMMUNITY_PRICE_DEVIATION) {
        return NextResponse.json(
          {
            error:
              'O preço enviado difere mais de 10% do valor de referência atual deste posto.',
          },
          { status: 422 }
        )
      }
    }

    // Insert price report
    const id = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await sql`
      INSERT INTO "DriverPriceReport" (
        id, "stationId", "fuelType", price, "reporterHash", "reporterLat", "reporterLng", "createdAt"
      )
      VALUES (
        ${id}, ${parsed.stationId}, ${parsed.fuelType}, ${parsed.price},
        ${reporterHash}, ${parsed.reporterLat}, ${parsed.reporterLng}, NOW()
      )
    `

    const recentReports = await sql`
      SELECT
        ROUND(AVG(price)::numeric, 2)::double precision as avg_price,
        MAX("createdAt") as updated_at,
        COUNT(*)::int as report_count
      FROM "DriverPriceReport"
      WHERE "stationId" = ${parsed.stationId}
        AND "fuelType" = ${parsed.fuelType}
        AND "createdAt" > NOW() - INTERVAL '7 days'
    `

    const communityPrice = recentReports[0]?.avg_price
      ? {
          fuelType: parsed.fuelType,
          price: Number(recentReports[0].avg_price),
          updatedAt: new Date(
            recentReports[0].updated_at || new Date().toISOString()
          ).toISOString(),
          reportCount: Number(recentReports[0].report_count || 1),
        }
      : null

    return NextResponse.json({ success: true, reportId: id, communityPrice })
  } catch (error) {
    console.error('[price-report] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos.' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Não foi possível salvar o reporte agora.' },
      { status: 500 }
    )
  }
}

async function buildReporterHash(
  request: NextRequest,
  parsed: z.infer<typeof reportSchema>
) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const userAgent = request.headers.get('user-agent')

  const ip =
    forwardedFor
      ?.split(',')
      .map((value) => value.trim())
      .find(Boolean) ||
    realIp?.trim() ||
    ''

  if (ip || userAgent?.trim()) {
    return createReporterHash(ip || 'unknown-ip', userAgent || 'unknown-agent')
  }

  return anonymizeLocation(parsed.reporterLat, parsed.reporterLng)
}
