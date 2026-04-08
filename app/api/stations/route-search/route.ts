import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSql } from '@/lib/db'

const querySchema = z.object({
  polyline: z.string(),
  bufferDistance: z.coerce.number().default(2000), // meters
})

export async function GET(request: NextRequest) {
  try {
    const sql = getSql()
    const { searchParams } = new URL(request.url)
    const polyline = searchParams.get('polyline')
    const bufferDistance = searchParams.get('bufferDistance') || '2000'

    if (!polyline) {
      return NextResponse.json(
        { error: 'Polyline parameter is required' },
        { status: 400 }
      )
    }

    const parsed = querySchema.parse({ polyline, bufferDistance: bufferDistance })

    // Decode polyline and create buffer polygon
    const coordinates = decodePolyline(polyline)
    const polygon = createBufferPolygon(coordinates, parseFloat(bufferDistance))

    // Query stations within polygon
    const stations = await sql`
      SELECT 
        s.id, s.name, s.address, s.lat, s.lng, s.brand, s.phone, s.source, s."isVerified",
        COALESCE(json_agg(
          json_build_object(
            'fuelType', fp."fuelType",
            'price', fp.price,
            'updatedAt', fp."updatedAt"
          ) ORDER BY fp."fuelType"
        ) FILTER (WHERE fp.id IS NOT NULL), '[]'::json) as fuel_prices
      FROM "Station" s
      LEFT JOIN "FuelPrice" fp ON s.id = fp."stationId"
      WHERE ST_Intersects(
        s.location,
        ST_Buffer(
          ST_GeomFromGeoJSON(${JSON.stringify(polygon)})::geography,
          ${parsed.bufferDistance}
        )
      )
      GROUP BY s.id
      ORDER BY s.name ASC
      LIMIT 100
    `

    return NextResponse.json(stations)
  } catch (error) {
    console.error('[route-search] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function decodePolyline(polyline: string): Array<[number, number]> {
  const coordinates: Array<[number, number]> = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < polyline.length) {
    let result = 0
    let shift = 0
    let byte = 0

    do {
      byte = polyline.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    result = 0
    shift = 0

    do {
      byte = polyline.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    coordinates.push([lat / 1e5, lng / 1e5])
  }

  return coordinates
}

function createBufferPolygon(
  coordinates: Array<[number, number]>,
  bufferDistance: number
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map(([lat, lng]) => [lng, lat]),
    },
  }
}
