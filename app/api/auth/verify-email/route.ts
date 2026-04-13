import { NextRequest, NextResponse } from 'next/server'
import { consumeAuthToken, markOwnerEmailVerified } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token de verificação inválido.' }, { status: 400 })
  }

  const consumedToken = await consumeAuthToken({
    token,
    type: 'EMAIL_VERIFICATION',
  })

  if (!consumedToken?.ownerId) {
    return NextResponse.json({ error: 'Este link é inválido ou já expirou.' }, { status: 400 })
  }

  const owner = await markOwnerEmailVerified(consumedToken.ownerId)

  if (!owner) {
    return NextResponse.json({ error: 'Não foi possível confirmar este email.' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    status: owner.status,
    message:
      owner.status === 'PENDING_APPROVAL'
        ? 'Email confirmado. Agora seu acesso aguarda aprovação do admin.'
        : 'Email confirmado com sucesso.',
  })
}
