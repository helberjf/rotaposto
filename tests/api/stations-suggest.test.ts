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

  it('creates a pending station suggestion', async () => {
    const sql = createMockSql([
      [],
      [],
      [],
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
    expect(body).toEqual({ success: true })
    expect(sql).toHaveBeenCalledTimes(3)
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
      error: 'Já existe um posto com esse nome nessa localização.',
    })
  })

  it('blocks duplicate pending suggestions for the same station area', async () => {
    const sql = createMockSql([[], [{ id: 'pending_suggestion' }]])
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
      error: 'Já existe uma sugestão pendente para esse posto.',
    })
    expect(sql).toHaveBeenCalledTimes(2)
  })

  it('validates the request body before touching the database', async () => {
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
    expect(getSqlMock).not.toHaveBeenCalled()
  })
})
