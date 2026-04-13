import { NextRequest, NextResponse } from 'next/server'
import {
  forgotPasswordSchema,
  getStationOwnerByEmail,
  sendPasswordResetEmail,
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = forgotPasswordSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Informe um email válido.' }, { status: 400 })
  }

  const owner = await getStationOwnerByEmail(parsed.data.email)

  if (owner && owner.emailVerifiedAt) {
    await sendPasswordResetEmail(owner)
  }

  return NextResponse.json({
    success: true,
    message:
      'Se existir uma conta com esse email, você receberá um link para redefinir sua senha.',
  })
}
