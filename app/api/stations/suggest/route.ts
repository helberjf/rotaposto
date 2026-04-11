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

    // Reject exact-name duplicate very close to an approved station
    const duplicateStation = await sql`
      SELECT id FROM "Station"
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${parsed.lng}, ${parsed.lat}), 4326)::geography,
        50
      )
      AND LOWER(name) = LOWER(${parsed.name})
      LIMIT 1
    `
    if (duplicateStation.length > 0) {
      return NextResponse.json(
        { error: 'Já existe um posto com esse nome nessa localização.' },
        { status: 409 }
      )
    }

    // Reject duplicate pending suggestion
    const duplicatePending = await sql`
      SELECT id FROM "StationSuggestion"
      WHERE status = 'PENDING'
        AND LOWER(name) = LOWER(${parsed.name})
        AND ABS(lat - ${parsed.lat}) < 0.002
        AND ABS(lng - ${parsed.lng}) < 0.002
      LIMIT 1
    `
    if (duplicatePending.length > 0) {
      return NextResponse.json(
        { error: 'Já existe uma sugestão pendente para esse posto.' },
        { status: 409 }
      )
    }

    const id = `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    await sql`
      INSERT INTO "StationSuggestion"
        (id, name, address, lat, lng, brand, phone, status, "createdAt", "updatedAt")
      VALUES
        (${id}, ${parsed.name}, ${parsed.address}, ${parsed.lat}, ${parsed.lng},
         ${parsed.brand ?? null}, ${parsed.phone ?? null}, 'PENDING', NOW(), NOW())
    `

    return NextResponse.json({ success: true }, { status: 201 })
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
