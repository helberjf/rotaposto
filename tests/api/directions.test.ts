import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/directions/route'

describe('GET /api/directions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes OSRM alternatives into the app response shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          { geometry: 'poly_a', distance: 1200, duration: 600 },
          { geometry: 'poly_b', distance: 1500, duration: 700 },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const request = new NextRequest(
      'http://localhost/api/directions?originLat=-21.76&originLng=-43.34&destinationLat=-21.75&destinationLng=-43.33'
    )

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      polyline: 'poly_a',
      distanceMeters: 1200,
      durationSeconds: 600,
      routes: [
        {
          polyline: 'poly_a',
          distanceMeters: 1200,
          durationSeconds: 600,
        },
        {
          polyline: 'poly_b',
          distanceMeters: 1500,
          durationSeconds: 700,
        },
      ],
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns validation errors when route params are missing', async () => {
    const request = new NextRequest(
      'http://localhost/api/directions?originLat=abc&originLng=-43.34&destinationLat=-21.75&destinationLng=-43.33'
    )

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Parâmetros inválidos.' })
  })

  it('returns a friendly error when the routing provider fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      })
    )

    const request = new NextRequest(
      'http://localhost/api/directions?originLat=-21.76&originLng=-43.34&destinationLat=-21.75&destinationLng=-43.33'
    )

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Não foi possível calcular essa rota.' })
  })
})
