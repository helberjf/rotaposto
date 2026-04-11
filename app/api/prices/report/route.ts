import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { anonymizeLocation } from '@/lib/anonymize'
import { getSql } from '@/lib/db'

const reportSchema = z.object({
  stationId: z.string(),
  fuelType: z.enum(['GASOLINE', 'ETHANOL', 'DIESEL', 'GNV']),
  price: z.coerce.number().positive(),
  reporterLat: z.coerce.number(),
  reporterLng: z.coerce.number(),
})

export async function POST(request: NextRequest) {
  try {
    const sql = getSql()
    const body = await request.json()
    const parsed = reportSchema.parse(body)

    // Anonymize reporter location
    const reporterHash = anonymizeLocation(parsed.reporterLat, parsed.reporterLng)

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
