import { describe, expect, it } from 'vitest'
import {
  anonymizeLocation,
  isWithinReportingDistance,
} from '@/lib/anonymize'

describe('anonymize helpers', () => {
  it('keeps the same coarse location hash inside the same rounded area', () => {
    const first = anonymizeLocation(-23.5614, -46.6558)
    const second = anonymizeLocation(-23.5642, -46.6551)

    expect(first).toBe(second)
  })

  it('changes the hash when the coarse rounded area changes', () => {
    const first = anonymizeLocation(-23.5614, -46.6558)
    const second = anonymizeLocation(-23.5714, -46.6658)

    expect(first).not.toBe(second)
  })

  it('detects whether the reporter is close enough to the station', () => {
    expect(
      isWithinReportingDistance(-23.5614, -46.6558, -23.562, -46.6558)
    ).toBe(true)

    expect(
      isWithinReportingDistance(-23.5614, -46.6558, -23.5714, -46.6558)
    ).toBe(false)
  })
})
