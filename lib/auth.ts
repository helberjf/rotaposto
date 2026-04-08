import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getSql } from '@/lib/db'

export const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
})

export type AuthInput = z.infer<typeof authSchema>

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function getStationOwnerByEmail(email: string) {
  try {
    const sql = getSql()
    const result = await sql`
      SELECT id, email, password, name, "createdAt", "updatedAt"
      FROM "StationOwner"
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `
    return result[0] || null
  } catch (error) {
    console.error('[auth] Error fetching owner by email:', error)
    return null
  }
}

export async function getStationOwnerById(id: string) {
  try {
    const sql = getSql()
    const result = await sql`
      SELECT id, email, name, "createdAt", "updatedAt"
      FROM "StationOwner"
      WHERE id = ${id}
      LIMIT 1
    `
    return result[0] || null
  } catch (error) {
    console.error('[auth] Error fetching owner by id:', error)
    return null
  }
}

export async function createStationOwner(
  email: string,
  hashedPassword: string,
  name: string
) {
  try {
    const sql = getSql()
    const id = `owner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const result = await sql`
      INSERT INTO "StationOwner" (id, email, password, name, "createdAt", "updatedAt")
      VALUES (${id}, ${email.toLowerCase()}, ${hashedPassword}, ${name}, NOW(), NOW())
      RETURNING id, email, name, "createdAt", "updatedAt"
    `
    return result[0]
  } catch (error) {
    console.error('[auth] Error creating owner:', error)
    throw error
  }
}
