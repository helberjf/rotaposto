import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  q: z.string().min(3),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const parsed = querySchema.parse({ q })

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'br')
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

    const results = (await response.json()) as Array<{
      lat: string
      lon: string
      display_name: string
    }>

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Endereço não encontrado.' },
        { status: 404 }
      )
    }

    const [place] = results

    return NextResponse.json({
      lat: Number(place.lat),
      lng: Number(place.lon),
      label: place.display_name,
    })
  } catch (error) {
    console.error('[geocode] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Informe um endereço válido.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Não foi possível localizar esse endereço.' },
      { status: 500 }
    )
  }
}
