import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import {
  approveStationOwner,
  listOwnerApprovalQueue,
  rejectStationOwner,
  sendOwnerApprovalStatusEmail,
} from '@/lib/auth'
import { isAdminSession } from '@/lib/auth/session'

const approvalSchema = z.object({
  ownerId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(300).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const owners = await listOwnerApprovalQueue()

  return NextResponse.json(
    owners.map((owner) => ({
      id: owner.id,
      name: owner.name,
      email: owner.email,
      cnpj: owner.cnpj,
      phone: owner.phone,
      status: owner.status,
      emailVerifiedAt: owner.emailVerifiedAt,
      approvedAt: owner.approvedAt,
      rejectionReason: owner.rejectionReason,
      createdAt: owner.createdAt,
    }))
  )
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || !isAdminSession(session) || !session.user.email) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = approvalSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Parâmetros inválidos.' },
      { status: 400 }
    )
  }

  const owner =
    parsed.data.action === 'APPROVE'
      ? await approveStationOwner(parsed.data.ownerId, session.user.email)
      : await rejectStationOwner(
          parsed.data.ownerId,
          session.user.email,
          parsed.data.rejectionReason
        )

  if (!owner) {
    return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 })
  }

  await sendOwnerApprovalStatusEmail(owner, parsed.data.action === 'APPROVE')

  return NextResponse.json({
    success: true,
    owner: {
      id: owner.id,
      status: owner.status,
      approvedAt: owner.approvedAt,
      rejectionReason: owner.rejectionReason,
    },
  })
}
