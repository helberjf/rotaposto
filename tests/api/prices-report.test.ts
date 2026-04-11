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
      [{ distance: 120 }],
      [{ report_count: 0 }],
      [{ report_count: 0 }],
      [{ avg_price: 5.4, report_count: 3 }],
      [],
      [
        {
          avg_price: 5.49,
          updated_at: '2026-04-11T18:31:30.407Z',
          report_count: 4,
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
      reportCount: 4,
    })
    expect(sql).toHaveBeenCalledTimes(6)
  })

  it('returns validation errors in Portuguese', async () => {
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
    expect(getSqlMock).not.toHaveBeenCalled()
  })

  it('blocks reports that differ more than 10% from the community price', async () => {
    const sql = createMockSql([
      [{ distance: 80 }],
      [{ report_count: 0 }],
      [{ report_count: 0 }],
      [{ avg_price: 5.0, report_count: 5 }],
    ])
    getSqlMock.mockReturnValue(sql)

    const request = new NextRequest('http://localhost/api/prices/report', {
      method: 'POST',
      body: JSON.stringify({
        stationId: 'station_1',
        fuelType: 'GASOLINE',
        price: 5.7,
        reporterLat: -23.5608,
        reporterLng: -46.6571,
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({
      error:
        'O preço enviado difere mais de 10% do valor de referência atual deste posto.',
    })
    expect(sql).toHaveBeenCalledTimes(4)
  })

  it('blocks repeated spam from the same reporter for the same fuel at the same station', async () => {
    const sql = createMockSql([
      [{ distance: 80 }],
      [{ report_count: 0 }],
      [{ report_count: 1 }],
    ])
    getSqlMock.mockReturnValue(sql)

    const request = new NextRequest('http://localhost/api/prices/report', {
      method: 'POST',
      body: JSON.stringify({
        stationId: 'station_1',
        fuelType: 'GASOLINE',
        price: 5.05,
        reporterLat: -23.5608,
        reporterLng: -46.6571,
      }),
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'vitest',
      },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body).toEqual({
      error:
        'Aguarde um pouco antes de atualizar novamente este combustível neste posto.',
    })
    expect(sql).toHaveBeenCalledTimes(3)
  })

  it('blocks excessive hourly spam from the same reporter fingerprint', async () => {
    const sql = createMockSql([
      [{ distance: 80 }],
      [{ report_count: 3 }],
    ])
    getSqlMock.mockReturnValue(sql)

    const request = new NextRequest('http://localhost/api/prices/report', {
      method: 'POST',
      body: JSON.stringify({
        stationId: 'station_1',
        fuelType: 'GASOLINE',
        price: 5.05,
        reporterLat: -23.5608,
        reporterLng: -46.6571,
      }),
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'vitest',
      },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body).toEqual({
      error: 'Você atingiu o limite de atualizações colaborativas por hora.',
    })
    expect(sql).toHaveBeenCalledTimes(2)
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
