import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  q: z.string().min(2).max(100),
  city: z.string().min(2).max(120),
})

interface NominatimResult {
  address?: {
    suburb?: string
    neighbourhood?: string
    quarter?: string
    village?: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.parse({
      q: searchParams.get('q') || '',
      city: searchParams.get('city') || '',
    })

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', `${parsed.q}, ${parsed.city}, Brasil`)
    url.searchParams.set('format', 'json')
    url.searchParams.set('countrycodes', 'br')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '15')
    url.searchParams.set('dedupe', '1')

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'Rotaposto/1.0',
      },
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      return NextResponse.json([])
    }

    const results = (await response.json()) as NominatimResult[]
    if (!Array.isArray(results)) return NextResponse.json([])

    // Extract distinct neighbourhood names from address details
    const seen = new Set<string>()
    const neighborhoods: string[] = []

    for (const place of results) {
      const name =
        place.address?.suburb ||
        place.address?.neighbourhood ||
        place.address?.quarter ||
        place.address?.village

      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        neighborhoods.push(name)
      }
    }

    return NextResponse.json(neighborhoods)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json([], { status: 400 })
    }
    console.error('[geocode-neighborhoods] Error:', error)
    return NextResponse.json([])
  }
}
