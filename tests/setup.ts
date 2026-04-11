import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret'
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
