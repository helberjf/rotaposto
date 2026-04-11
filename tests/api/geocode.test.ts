import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/geocode/route'

describe('GET /api/geocode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns normalized coordinates from Nominatim', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            lat: '-21.7626',
            lon: '-43.3476',
            display_name: 'Avenida Rio Branco, Juiz de Fora - MG',
          },
        ],
      })
    )

    const request = new NextRequest(
      'http://localhost/api/geocode?q=Avenida%20Rio%20Branco%20Juiz%20de%20Fora'
    )

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      lat: -21.7626,
      lng: -43.3476,
      label: 'Avenida Rio Branco, Juiz de Fora - MG',
    })
  })

  it('returns 404 when no address is found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
    )

    const request = new NextRequest(
      'http://localhost/api/geocode?q=Avenida%20Desconhecida'
    )

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Endereço não encontrado.' })
  })

  it('validates short queries before calling the provider', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const request = new NextRequest('http://localhost/api/geocode?q=ab')

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Informe um endereço válido.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
