import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  q: z.string().min(3),
})

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  name?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const parsed = querySchema.parse({ q })

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '5')
    url.searchParams.set('countrycodes', 'br')
    url.searchParams.set('dedupe', '1')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('q', parsed.q)

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'Rotaposto/1.0',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('Erro ao consultar o serviço de geocodificação.')
    }

    const results = (await response.json()) as NominatimResult[]
    if (!Array.isArray(results)) {
      return NextResponse.json([])
    }

    return NextResponse.json(
      results.map((place) => {
        const { primaryText, secondaryText } = splitLocationLabel(place)

        return {
          label: place.display_name,
          lat: Number(place.lat),
          lng: Number(place.lon),
          primaryText,
          secondaryText,
        }
      })
    )
  } catch (error) {
    console.error('[geocode-suggest] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json([], { status: 200 })
    }

    return NextResponse.json(
      { error: 'Não foi possível buscar sugestões.' },
      { status: 500 }
    )
  }
}

function splitLocationLabel(place: NominatimResult) {
  const parts = place.display_name
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  const primaryText = place.name?.trim() || parts[0] || place.display_name
  const secondaryText = parts.slice(1).join(', ')

  return { primaryText, secondaryText }
}
