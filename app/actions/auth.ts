'use server'

import {
  authSchema,
  hashPassword,
  createStationOwner,
  getStationOwnerByEmail,
} from '@/lib/auth'

export async function registerOwner(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const name = formData.get('name') as string

  try {
    authSchema.parse({ email, password, name })
  } catch {
    return { error: 'Dados invÃ¡lidos' }
  }

  if (password !== confirmPassword) {
    return { error: 'Senhas nÃ£o correspondem' }
  }

  const existingOwner = await getStationOwnerByEmail(email)
  if (existingOwner) {
    return { error: 'Email jÃ¡ registrado' }
  }

  try {
    const hashedPassword = await hashPassword(password)
    await createStationOwner(email, hashedPassword, name)
    return { success: true }
  } catch (error) {
    console.error('[register] Error:', error)
    return { error: 'Erro ao registrar. Tente novamente.' }
  }
}
