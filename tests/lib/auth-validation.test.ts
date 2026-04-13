import { describe, expect, it } from 'vitest'
import {
  loginSchema,
  registerOwnerSchema,
  resetPasswordSchema,
} from '@/lib/auth'

describe('owner auth validation', () => {
  it('accepts a valid owner registration payload', () => {
    const result = registerOwnerSchema.safeParse({
      name: 'João Silva',
      email: 'TESTE@EMPRESA.COM',
      cnpj: '12.345.678/0001-95',
      phone: '(32) 99999-0000',
      password: 'Senha@123',
      confirmPassword: 'Senha@123',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('teste@empresa.com')
    }
  })

  it('rejects invalid CNPJ values during registration', () => {
    const result = registerOwnerSchema.safeParse({
      name: 'João Silva',
      email: 'teste@empresa.com',
      cnpj: '11.111.111/1111-11',
      phone: '(32) 99999-0000',
      password: 'Senha@123',
      confirmPassword: 'Senha@123',
    })

    expect(result.success).toBe(false)
  })

  it('requires admin or owner login scope payloads with valid email', () => {
    const valid = loginSchema.safeParse({
      email: 'admin@rotaposto.com',
      password: 'Admin@123!',
      scope: 'ADMIN',
    })
    const invalid = loginSchema.safeParse({
      email: 'email-invalido',
      password: '123',
      scope: 'OWNER',
    })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it('rejects reset password payloads when confirmation differs', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'token-teste',
      password: 'Senha@123',
      confirmPassword: 'Senha@124',
    })

    expect(result.success).toBe(false)
  })
})
