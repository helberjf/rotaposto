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

    // Update station's fuel price with average of recent reports
    const recentReports = await sql`
      SELECT AVG(price) as avg_price
      FROM "DriverPriceReport"
      WHERE "stationId" = ${parsed.stationId}
        AND "fuelType" = ${parsed.fuelType}
        AND "createdAt" > NOW() - INTERVAL '24 hours'
    `

    if (recentReports[0]?.avg_price) {
      const avgPrice = recentReports[0].avg_price
      
      // Try to update existing price
      const existing = await sql`
        UPDATE "FuelPrice"
        SET price = ${avgPrice}, "updatedAt" = NOW()
        WHERE "stationId" = ${parsed.stationId} AND "fuelType" = ${parsed.fuelType}
        RETURNING id
      `

      // If no existing record, create one
      if (existing.length === 0) {
        const priceId = `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        await sql`
          INSERT INTO "FuelPrice" (id, "stationId", "fuelType", price, "updatedAt")
          VALUES (${priceId}, ${parsed.stationId}, ${parsed.fuelType}, ${avgPrice}, NOW())
        `
      }
    }

    return NextResponse.json({ success: true, reportId: id })
  } catch (error) {
    console.error('[price-report] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
