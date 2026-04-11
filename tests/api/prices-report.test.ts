import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSql } from '../support/mock-sql'

const { getSqlMock } = vi.hoisted(() => ({
  getSqlMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getSql: getSqlMock,
}))

import { POST } from '@/app/api/prices/report/route'

describe('POST /api/prices/report', () => {
  beforeEach(() => {
    getSqlMock.mockReset()
  })

  it('stores a report and returns the aggregated community price', async () => {
    const sql = createMockSql([
      [],
      [
        {
          avg_price: 5.49,
          updated_at: '2026-04-11T18:31:30.407Z',
          report_count: 2,
        },
      ],
    ])
    getSqlMock.mockReturnValue(sql)

    const request = new NextRequest('http://localhost/api/prices/report', {
      method: 'POST',
      body: JSON.stringify({
        stationId: 'station_1',
        fuelType: 'GASOLINE',
        price: 5.49,
        reporterLat: -23.5608,
        reporterLng: -46.6571,
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.reportId).toMatch(/^report_/)
    expect(body.communityPrice).toEqual({
      fuelType: 'GASOLINE',
      price: 5.49,
      updatedAt: '2026-04-11T18:31:30.407Z',
      reportCount: 2,
    })
    expect(sql).toHaveBeenCalledTimes(2)
  })

  it('returns validation errors in Portuguese', async () => {
    const sql = createMockSql([])
    getSqlMock.mockReturnValue(sql)

    const request = new NextRequest('http://localhost/api/prices/report', {
      method: 'POST',
      body: JSON.stringify({
        stationId: 'station_1',
        fuelType: 'GASOLINE',
        price: 0,
        reporterLat: -23.5608,
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Parâmetros inválidos.' })
    expect(getSqlMock).toHaveBeenCalledTimes(1)
    expect(sql).not.toHaveBeenCalled()
  })

  it('returns a friendly server error when the database fails', async () => {
    const sql = createMockSql([new Error('db unavailable')])
    getSqlMock.mockReturnValue(sql)

    const request = new NextRequest('http://localhost/api/prices/report', {
      method: 'POST',
      body: JSON.stringify({
        stationId: 'station_1',
        fuelType: 'GASOLINE',
        price: 5.49,
        reporterLat: -23.5608,
        reporterLng: -46.6571,
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Não foi possível salvar o reporte agora.' })
  })
})
