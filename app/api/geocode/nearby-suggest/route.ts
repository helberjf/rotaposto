import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
})

interface OverpassElement {
  id: number
  lat?: number
  lon?: number
  center?: {
    lat: number
    lon: number
  }
  tags?: Record<string, string>
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const parsed = querySchema.parse({ lat, lng })

    const overpassQuery = `
[out:json][timeout:20];
(
  node(around:1500,${parsed.lat},${parsed.lng})[name][amenity];
  node(around:1500,${parsed.lat},${parsed.lng})[name][shop];
  node(around:1500,${parsed.lat},${parsed.lng})[name][tourism];
  node(around:1500,${parsed.lat},${parsed.lng})[name][leisure];
  node(around:1500,${parsed.lat},${parsed.lng})[name][public_transport];
  way(around:1500,${parsed.lat},${parsed.lng})[name][amenity];
  way(around:1500,${parsed.lat},${parsed.lng})[name][shop];
  way(around:1500,${parsed.lat},${parsed.lng})[name][tourism];
  way(around:1500,${parsed.lat},${parsed.lng})[name][leisure];
  way(around:1500,${parsed.lat},${parsed.lng})[name][public_transport];
);
out center 20;
`

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'User-Agent': 'Rotaposto/1.0',
      },
      body: overpassQuery,
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('Erro ao consultar locais próximos.')
    }

    const payload = (await response.json()) as { elements?: OverpassElement[] }
    const elements = Array.isArray(payload.elements) ? payload.elements : []

    const suggestions = elements
      .map((element) => {
        const point = getPoint(element)
        const name = element.tags?.name?.trim()

        if (!point || !name) {
          return null
        }

        const kind =
          element.tags?.amenity ||
          element.tags?.shop ||
          element.tags?.tourism ||
          element.tags?.leisure ||
          element.tags?.public_transport ||
          'Local'

        const distanceMeters = haversineMeters(
          parsed.lat,
          parsed.lng,
          point.lat,
          point.lng
        )

        return {
          id: `${element.id}-${name}`,
          label: `${name}, ${formatKind(kind)}`,
          lat: point.lat,
          lng: point.lng,
          primaryText: name,
          secondaryText: `${formatKind(kind)} • ${formatDistance(distanceMeters)}`,
          distanceMeters,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 6)
      .map((item) => ({
        label: item.label,
        lat: item.lat,
        lng: item.lng,
        primaryText: item.primaryText,
        secondaryText: item.secondaryText,
      }))

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('[geocode-nearby-suggest] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json([], { status: 200 })
    }

    return NextResponse.json([], { status: 200 })
  }
}

function getPoint(element: OverpassElement) {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lng: element.lon }
  }

  if (element.center) {
    return { lat: element.center.lat, lng: element.center.lon }
  }

  return null
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number) {
  return deg * (Math.PI / 180)
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m de você`
  }

  return `${(distanceMeters / 1000).toFixed(1)} km de você`
}

function formatKind(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
