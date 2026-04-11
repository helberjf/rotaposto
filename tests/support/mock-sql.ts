import { vi } from 'vitest'

type MockSqlResponse =
  | unknown
  | Error
  | ((input: {
      strings: TemplateStringsArray
      values: unknown[]
      callIndex: number
    }) => unknown | Promise<unknown>)

export function createMockSql(responses: MockSqlResponse[]) {
  let callIndex = 0

  return vi.fn(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const current = responses[callIndex]
      callIndex += 1

      if (current instanceof Error) {
        throw current
      }

      if (typeof current === 'function') {
        return current({ strings, values, callIndex: callIndex - 1 })
      }

      return current ?? []
    }
  )
}
