import { NextRequest, NextResponse } from 'next/server'
import {
  consumeAuthToken,
  getStationOwnerById,
  hashPassword,
  resetPasswordSchema,
  updateOwnerPassword,
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = resetPasswordSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message || 'Não foi possível validar a nova senha.',
      },
      { status: 400 }
    )
  }

  const consumedToken = await consumeAuthToken({
    token: parsed.data.token,
    type: 'PASSWORD_RESET',
  })

  if (!consumedToken?.ownerId) {
    return NextResponse.json(
      { error: 'Este link de redefinição é inválido ou já expirou.' },
      { status: 400 }
    )
  }

  const owner = await getStationOwnerById(consumedToken.ownerId)
  if (!owner) {
    return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 })
  }

  const hashedPassword = await hashPassword(parsed.data.password)
  await updateOwnerPassword(owner.id, hashedPassword)

  return NextResponse.json({
    success: true,
    message: 'Senha atualizada com sucesso. Você já pode entrar na plataforma.',
  })
}
