'use server'

import {
  createStationOwner,
  getStationOwnerByEmail,
  hashPassword,
  isAdminEmail,
  normalizeCnpj,
  normalizeEmail,
  registerOwnerSchema,
  sendOwnerVerificationEmail,
} from '@/lib/auth'

export async function registerOwner(formData: FormData) {
  const rawPayload = {
    name: String(formData.get('name') || ''),
    email: String(formData.get('email') || ''),
    cnpj: String(formData.get('cnpj') || ''),
    phone: String(formData.get('phone') || ''),
    password: String(formData.get('password') || ''),
    confirmPassword: String(formData.get('confirmPassword') || ''),
  }

  const parsed = registerOwnerSchema.safeParse(rawPayload)

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message || 'Não foi possível validar os dados.',
    }
  }

  const payload = parsed.data
  const normalizedEmail = normalizeEmail(payload.email)
  const normalizedCnpj = normalizeCnpj(payload.cnpj)

  const existingOwner = await getStationOwnerByEmail(normalizedEmail)
  if (existingOwner) {
    return { error: 'Já existe uma conta cadastrada com esse email.' }
  }

  if (isAdminEmail(normalizedEmail)) {
    return { error: 'Esse email está reservado para a administração do sistema.' }
  }

  try {
    const hashedPassword = await hashPassword(payload.password)
    const owner = await createStationOwner({
      email: normalizedEmail,
      hashedPassword,
      name: payload.name,
      cnpj: normalizedCnpj,
      phone: payload.phone,
    })

    await sendOwnerVerificationEmail(owner)

    return {
      success: true,
      message:
        'Conta criada. Confira seu email para confirmar o cadastro antes da aprovação.',
    }
  } catch (error) {
    console.error('[register-owner] Error:', error)

    if (
      error instanceof Error &&
      /StationOwner_cnpj_key|unique|duplicate/i.test(error.message)
    ) {
      return { error: 'Já existe uma conta cadastrada com esse CNPJ.' }
    }

    return { error: 'Erro ao registrar. Tente novamente em instantes.' }
  }
}
