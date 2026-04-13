import { NextRequest, NextResponse } from 'next/server'
import { emailSchema, getStationOwnerByEmail, sendOwnerVerificationEmail } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = emailSchema.safeParse(body?.email || '')

  if (!parsed.success) {
    return NextResponse.json({ error: 'Informe um email válido.' }, { status: 400 })
  }

  const owner = await getStationOwnerByEmail(parsed.data)

  if (!owner) {
    return NextResponse.json({
      success: true,
      message: 'Se existir uma conta com esse email, enviaremos um novo link.',
    })
  }

  if (owner.emailVerifiedAt) {
    return NextResponse.json({
      success: true,
      message: 'Esse email já foi confirmado.',
    })
  }

  await sendOwnerVerificationEmail(owner)

  return NextResponse.json({
    success: true,
    message: 'Enviamos um novo link de confirmação para o seu email.',
  })
}
