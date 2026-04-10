import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  originLat: z.coerce.number(),
  originLng: z.coerce.number(),
  destinationLat: z.coerce.number(),
  destinationLng: z.coerce.number(),
})

interface OsrmRoute {
  geometry: string
  distance: number
  duration: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const originLat = searchParams.get('originLat')
    const originLng = searchParams.get('originLng')
    const destinationLat = searchParams.get('destinationLat')
    const destinationLng = searchParams.get('destinationLng')

    const parsed = querySchema.parse({
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    })

    const url = new URL(
      `https://router.project-osrm.org/route/v1/driving/${parsed.originLng},${parsed.originLat};${parsed.destinationLng},${parsed.destinationLat}`
    )
    url.searchParams.set('overview', 'full')
    url.searchParams.set('geometries', 'polyline')
    url.searchParams.set('steps', 'false')
    url.searchParams.set('alternatives', '3')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Rotaposto/1.0',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('Erro ao consultar o serviço de rotas.')
    }

    const payload = (await response.json()) as {
      routes?: OsrmRoute[]
    }

    const routes =
      payload.routes
        ?.filter(
          (route) =>
            typeof route.geometry === 'string' &&
            Number.isFinite(route.distance) &&
            Number.isFinite(route.duration)
        )
        .map((route) => ({
          polyline: route.geometry,
          distanceMeters: route.distance,
          durationSeconds: route.duration,
        })) ?? []

    const route = routes[0]

    if (!route) {
      return NextResponse.json(
        { error: 'Não foi possível calcular essa rota.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      polyline: route.polyline,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      routes,
    })
  } catch (error) {
    console.error('[directions] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Não foi possível calcular essa rota.' },
      { status: 500 }
    )
  }
}
