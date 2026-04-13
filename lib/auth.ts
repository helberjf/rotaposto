import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { getSql } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import {
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  registerOwnerSchema,
  resetPasswordSchema,
} from '@/lib/auth/validation'

export {
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  registerOwnerSchema,
  resetPasswordSchema,
}

export type OwnerRole = 'OWNER' | 'ADMIN'
export type OwnerAccountStatus =
  | 'PENDING_EMAIL_VERIFICATION'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'REJECTED'
  | 'BLOCKED'
export type AuthTokenType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET'

export interface StationOwnerRecord {
  id: string
  email: string
  password: string
  name: string
  cnpj: string | null
  phone: string | null
  role: OwnerRole
  status: OwnerAccountStatus
  emailVerifiedAt: string | null
  approvedAt: string | null
  approvedByEmail: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export interface SessionUserRecord {
  id: string
  email: string
  name: string
  role: OwnerRole
  status: OwnerAccountStatus
}

const TOKEN_EXPIRATION_HOURS: Record<AuthTokenType, number> = {
  EMAIL_VERIFICATION: 24,
  PASSWORD_RESET: 2,
}

type RawSqlExecutor = (
  query: string,
  params?: unknown[]
) => Promise<Array<Record<string, unknown>>>

const OWNER_SELECT = `
  id,
  email,
  password,
  name,
  cnpj,
  phone,
  role,
  status,
  "emailVerifiedAt",
  "approvedAt",
  "approvedByEmail",
  "rejectionReason",
  "createdAt",
  "updatedAt"
`

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function runSqlQuery(
  sql: ReturnType<typeof getSql>,
  query: string,
  params: unknown[] = []
) {
  return ((sql as ReturnType<typeof getSql> & { query: RawSqlExecutor }).query)(
    query,
    params
  )
}

function toIsoString(value: unknown) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return String(value)
}

function mapOwnerRecord(row: Record<string, unknown>): StationOwnerRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    password: String(row.password),
    name: String(row.name),
    cnpj: row.cnpj ? String(row.cnpj) : null,
    phone: row.phone ? String(row.phone) : null,
    role: String(row.role || 'OWNER') as OwnerRole,
    status: String(
      row.status || 'PENDING_EMAIL_VERIFICATION'
    ) as OwnerAccountStatus,
    emailVerifiedAt: toIsoString(row.emailVerifiedAt),
    approvedAt: toIsoString(row.approvedAt),
    approvedByEmail: row.approvedByEmail ? String(row.approvedByEmail) : null,
    rejectionReason: row.rejectionReason ? String(row.rejectionReason) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }
}

function buildAppUrl(pathname: string) {
  const baseUrl =
    process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://localhost:3000'

  return new URL(pathname, baseUrl).toString()
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

export function normalizeCnpj(cnpj: string) {
  return cnpj.replace(/\D/g, '')
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function isAdminEmail(email: string | null | undefined) {
  if (!process.env.ADMIN_EMAIL || !email) {
    return false
  }

  return normalizeEmail(email) === normalizeEmail(process.env.ADMIN_EMAIL)
}

export async function authenticateAdmin(
  email: string,
  password: string
): Promise<SessionUserRecord | null> {
  if (!isAdminEmail(email)) {
    return null
  }

  const configuredHash = process.env.ADMIN_PASSWORD_HASH
  const configuredPlainText = process.env.ADMIN_PASSWORD

  let matches = false

  if (configuredHash) {
    matches = await bcrypt.compare(password, configuredHash)
  } else if (configuredPlainText) {
    matches = password === configuredPlainText
  }

  if (!matches) {
    return null
  }

  return {
    id: 'admin-env',
    email: normalizeEmail(email),
    name: process.env.ADMIN_NAME || 'Administrador Rotaposto',
    role: 'ADMIN',
    status: 'ACTIVE',
  }
}

export async function getStationOwnerByEmail(email: string) {
  try {
    const sql = getSql()
    const result = await runSqlQuery(
      sql,
      `SELECT ${OWNER_SELECT} FROM "StationOwner" WHERE email = $1 LIMIT 1`,
      [normalizeEmail(email)]
    )

    return result[0] ? mapOwnerRecord(result[0]) : null
  } catch (error) {
    console.error('[auth] Error fetching owner by email:', error)
    return null
  }
}

export async function getStationOwnerById(id: string) {
  try {
    const sql = getSql()
    const result = await runSqlQuery(
      sql,
      `SELECT ${OWNER_SELECT} FROM "StationOwner" WHERE id = $1 LIMIT 1`,
      [id]
    )

    return result[0] ? mapOwnerRecord(result[0]) : null
  } catch (error) {
    console.error('[auth] Error fetching owner by id:', error)
    return null
  }
}

export async function createStationOwner(input: {
  email: string
  hashedPassword: string
  name: string
  cnpj: string
  phone: string
}) {
  const sql = getSql()
  const ownerId = generateId('owner')
  const email = normalizeEmail(input.email)
  const cnpj = normalizeCnpj(input.cnpj)
  const phone = normalizePhone(input.phone)

  const result = await runSqlQuery(
    sql,
    `INSERT INTO "StationOwner" (
      id,
      email,
      password,
      name,
      cnpj,
      phone,
      role,
      status,
      "createdAt",
      "updatedAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'OWNER', 'PENDING_EMAIL_VERIFICATION', NOW(), NOW())
    RETURNING ${OWNER_SELECT}`,
    [ownerId, email, input.hashedPassword, input.name.trim(), cnpj, phone]
  )

  return mapOwnerRecord(result[0])
}

export async function createAuthToken({
  email,
  ownerId,
  type,
}: {
  email: string
  ownerId: string | null
  type: AuthTokenType
}) {
  const sql = getSql()
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expirationHours = TOKEN_EXPIRATION_HOURS[type]
  const tokenId = generateId('token')

  await sql`
    DELETE FROM "AuthToken"
    WHERE email = ${normalizeEmail(email)} AND type = ${type}
  `

  await sql`
    INSERT INTO "AuthToken" (
      id,
      email,
      type,
      "tokenHash",
      "expiresAt",
      "ownerId",
      "createdAt"
    )
    VALUES (
      ${tokenId},
      ${normalizeEmail(email)},
      ${type},
      ${tokenHash},
      NOW() + (${expirationHours} * INTERVAL '1 hour'),
      ${ownerId},
      NOW()
    )
  `

  return token
}

export async function consumeAuthToken({
  token,
  type,
}: {
  token: string
  type: AuthTokenType
}) {
  const sql = getSql()
  const tokenHash = hashToken(token)
  const rows = await sql`
    SELECT id, email, "ownerId", "expiresAt"
    FROM "AuthToken"
    WHERE "tokenHash" = ${tokenHash} AND type = ${type}
    LIMIT 1
  `

  const tokenRow = rows[0]

  if (!tokenRow) {
    return null
  }

  const expiresAt =
    tokenRow.expiresAt instanceof Date
      ? tokenRow.expiresAt
      : new Date(String(tokenRow.expiresAt))

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    await sql`DELETE FROM "AuthToken" WHERE id = ${String(tokenRow.id)}`
    return null
  }

  await sql`DELETE FROM "AuthToken" WHERE id = ${String(tokenRow.id)}`

  return {
    id: String(tokenRow.id),
    email: normalizeEmail(String(tokenRow.email)),
    ownerId: tokenRow.ownerId ? String(tokenRow.ownerId) : null,
  }
}

export async function markOwnerEmailVerified(ownerId: string) {
  const sql = getSql()
  const result = await runSqlQuery(
    sql,
    `UPDATE "StationOwner"
     SET
       "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW()),
       status = CASE
         WHEN status = 'PENDING_EMAIL_VERIFICATION' THEN 'PENDING_APPROVAL'
         ELSE status
       END,
       "updatedAt" = NOW()
     WHERE id = $1
     RETURNING ${OWNER_SELECT}`,
    [ownerId]
  )

  return result[0] ? mapOwnerRecord(result[0]) : null
}

export async function updateOwnerPassword(
  ownerId: string,
  hashedPassword: string
) {
  const sql = getSql()

  await sql`
    UPDATE "StationOwner"
    SET password = ${hashedPassword}, "updatedAt" = NOW()
    WHERE id = ${ownerId}
  `
}

export async function listOwnerApprovalQueue() {
  const sql = getSql()
  const rows = await runSqlQuery(
    sql,
    `SELECT ${OWNER_SELECT}
     FROM "StationOwner"
     WHERE role = 'OWNER'
     ORDER BY
       CASE status
         WHEN 'PENDING_APPROVAL' THEN 0
         WHEN 'REJECTED' THEN 1
         WHEN 'ACTIVE' THEN 2
         WHEN 'BLOCKED' THEN 3
         ELSE 4
       END,
       "createdAt" DESC`
  )

  return rows.map((row) => mapOwnerRecord(row))
}

export async function approveStationOwner(
  ownerId: string,
  adminEmail: string
) {
  const sql = getSql()
  const result = await runSqlQuery(
    sql,
    `UPDATE "StationOwner"
     SET
       status = 'ACTIVE',
       "approvedAt" = NOW(),
       "approvedByEmail" = $2,
       "rejectionReason" = NULL,
       "updatedAt" = NOW()
     WHERE id = $1 AND "emailVerifiedAt" IS NOT NULL
     RETURNING ${OWNER_SELECT}`,
    [ownerId, normalizeEmail(adminEmail)]
  )

  return result[0] ? mapOwnerRecord(result[0]) : null
}

export async function rejectStationOwner(
  ownerId: string,
  adminEmail: string,
  rejectionReason?: string
) {
  const sql = getSql()
  const result = await runSqlQuery(
    sql,
    `UPDATE "StationOwner"
     SET
       status = 'REJECTED',
       "approvedAt" = NULL,
       "approvedByEmail" = $2,
       "rejectionReason" = $3,
       "updatedAt" = NOW()
     WHERE id = $1
     RETURNING ${OWNER_SELECT}`,
    [
      ownerId,
      normalizeEmail(adminEmail),
      rejectionReason?.trim() || 'Cadastro recusado pela administração.',
    ]
  )

  return result[0] ? mapOwnerRecord(result[0]) : null
}

export async function sendOwnerVerificationEmail(owner: StationOwnerRecord) {
  const token = await createAuthToken({
    email: owner.email,
    ownerId: owner.id,
    type: 'EMAIL_VERIFICATION',
  })
  const verificationUrl = buildAppUrl(`/owner/verify-email?token=${token}`)

  await sendEmail({
    to: owner.email,
    subject: 'Confirme seu email na Rotaposto',
    html: `
      <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">Confirme seu email</h2>
        <p>Olá, ${owner.name}.</p>
        <p>Recebemos seu cadastro de dono de posto na Rotaposto. Confirme seu email para que a análise do acesso possa começar.</p>
        <p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #f97316; color: #ffffff; text-decoration: none; font-weight: 600;">
            Confirmar email
          </a>
        </p>
        <p>Se o botão não abrir, use este link:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(owner: StationOwnerRecord) {
  const token = await createAuthToken({
    email: owner.email,
    ownerId: owner.id,
    type: 'PASSWORD_RESET',
  })
  const resetUrl = buildAppUrl(`/owner/reset-password?token=${token}`)

  await sendEmail({
    to: owner.email,
    subject: 'Redefina sua senha da Rotaposto',
    html: `
      <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">Recuperação de senha</h2>
        <p>Olá, ${owner.name}.</p>
        <p>Recebemos uma solicitação para redefinir sua senha. Se foi você, clique no botão abaixo.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #18181b; color: #ffffff; text-decoration: none; font-weight: 600;">
            Redefinir senha
          </a>
        </p>
        <p>Se preferir, copie e cole este link no navegador:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
      </div>
    `,
  })
}

export async function sendOwnerApprovalStatusEmail(
  owner: StationOwnerRecord,
  approved: boolean
) {
  const title = approved ? 'Seu acesso foi aprovado' : 'Seu cadastro precisa de ajustes'
  const description = approved
    ? 'Seu acesso de dono de posto já está liberado. Você pode entrar e gerenciar postos e preços.'
    : `Seu cadastro foi analisado, mas não pôde ser aprovado neste momento.${owner.rejectionReason ? ` Motivo informado: ${owner.rejectionReason}` : ''}`

  await sendEmail({
    to: owner.email,
    subject: approved
      ? 'Acesso aprovado na Rotaposto'
      : 'Atualização sobre seu cadastro na Rotaposto',
    html: `
      <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">${title}</h2>
        <p>Olá, ${owner.name}.</p>
        <p>${description}</p>
        <p>
          <a href="${buildAppUrl('/owner/login')}" style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #f97316; color: #ffffff; text-decoration: none; font-weight: 600;">
            Ir para o login
          </a>
        </p>
      </div>
    `,
  })
}
