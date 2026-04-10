import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const parsed = querySchema.parse({ lat, lng })

    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(parsed.lat))
    url.searchParams.set('lon', String(parsed.lng))
    url.searchParams.set('zoom', '18')
    url.searchParams.set('addressdetails', '1')

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'Rotaposto/1.0',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('Erro ao consultar o serviço de geocodificação reversa.')
    }

    const result = (await response.json()) as {
      display_name?: string
    }

    return NextResponse.json({
      lat: parsed.lat,
      lng: parsed.lng,
      label: result.display_name || 'Minha localização atual',
    })
  } catch (error) {
    console.error('[geocode-reverse] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Coordenadas inválidas.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Não foi possível identificar sua localização.' },
      { status: 500 }
    )
  }
}
