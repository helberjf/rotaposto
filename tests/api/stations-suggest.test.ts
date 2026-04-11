import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSql } from '../support/mock-sql'

const { getSqlMock } = vi.hoisted(() => ({
  getSqlMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getSql: getSqlMock,
}))

import { POST } from '@/app/api/stations/suggest/route'

describe('POST /api/stations/suggest', () => {
  beforeEach(() => {
    getSqlMock.mockReset()
  })

  it('creates a station suggestion and returns empty price lists', async () => {
    const sql = createMockSql([
      [],
      [
        {
          id: 'station_123',
          name: 'Posto Teste',
          address: 'Avenida Brasil, 1000',
          lat: -21.76,
          lng: -43.34,
          brand: 'Teste',
          phone: '(32) 99999-0000',
          source: 'DRIVER',
          isVerified: false,
        },
      ],
    ])
    getSqlMock.mockReturnValue(sql)

    const request = new NextRequest('http://localhost/api/stations/suggest', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Posto Teste',
        address: 'Avenida Brasil, 1000',
        lat: -21.76,
        lng: -43.34,
        brand: 'Teste',
        phone: '(32) 99999-0000',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.station).toMatchObject({
      id: 'station_123',
      name: 'Posto Teste',
      owner_prices: [],
      community_prices: [],
      fuel_prices: [],
    })
    expect(sql).toHaveBeenCalledTimes(2)
  })

  it('blocks duplicate suggestions nearby', async () => {
    const sql = createMockSql([[{ id: 'station_existing' }]])
    getSqlMock.mockReturnValue(sql)

    const request = new NextRequest('http://localhost/api/stations/suggest', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Posto Teste',
        address: 'Avenida Brasil, 1000',
        lat: -21.76,
        lng: -43.34,
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toEqual({
      error: 'Já existe um posto parecido cadastrado nessa região.',
    })
  })

  it('validates the request body before touching the database', async () => {
    const sql = createMockSql([])
    getSqlMock.mockReturnValue(sql)

    const request = new NextRequest('http://localhost/api/stations/suggest', {
      method: 'POST',
      body: JSON.stringify({
        name: 'A',
        address: 'Rua',
        lat: -21.76,
        lng: -43.34,
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      error: 'Preencha os dados do posto corretamente.',
    })
    expect(getSqlMock).toHaveBeenCalledTimes(1)
    expect(sql).not.toHaveBeenCalled()
  })
})
