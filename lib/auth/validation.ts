import { z } from 'zod'

function hasFullName(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  return parts.length >= 2 && parts.every((part) => part.length >= 2)
}

function isValidBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, '')

  return digits.length >= 10 && digits.length <= 13
}

function isValidCnpj(value: string) {
  const digits = value.replace(/\D/g, '')

  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) {
    return false
  }

  const calculateDigit = (base: string, factors: number[]) => {
    const total = base
      .split('')
      .reduce(
        (sum, current, index) => sum + Number(current) * factors[index],
        0
      )
    const remainder = total % 11

    return remainder < 2 ? 0 : 11 - remainder
  }

  const firstDigit = calculateDigit(digits.slice(0, 12), [
    5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2,
  ])
  const secondDigit = calculateDigit(`${digits.slice(0, 12)}${firstDigit}`, [
    6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2,
  ])

  return digits.endsWith(`${firstDigit}${secondDigit}`)
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Informe um email válido.')

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .regex(/[a-z]/, 'A senha precisa ter ao menos uma letra minúscula.')
  .regex(/[A-Z]/, 'A senha precisa ter ao menos uma letra maiúscula.')
  .regex(/[0-9]/, 'A senha precisa ter ao menos um número.')
  .regex(/[^a-zA-Z0-9]/, 'A senha precisa ter ao menos um caractere especial.')

export const ownerNameSchema = z
  .string()
  .trim()
  .refine(hasFullName, 'Informe nome e sobrenome do responsável.')

export const phoneSchema = z
  .string()
  .trim()
  .refine(isValidBrazilianPhone, 'Informe um telefone válido com DDD.')

export const cnpjSchema = z
  .string()
  .trim()
  .refine(isValidCnpj, 'Informe um CNPJ válido.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória.'),
  scope: z.enum(['OWNER', 'ADMIN']).optional().default('OWNER'),
})

export const registerOwnerSchema = z
  .object({
    name: ownerNameSchema,
    email: emailSchema,
    cnpj: cnpjSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'As senhas não coincidem.',
      })
    }
  })

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token inválido.'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'As senhas não coincidem.',
      })
    }
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterOwnerInput = z.infer<typeof registerOwnerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
