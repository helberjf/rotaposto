import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getStationOwnerById } from '@/lib/auth'
import { isOwnerSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || !isOwnerSession(session)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 401 })
  }

  const owner = await getStationOwnerById(session.user.id)

  if (!owner) {
    return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 })
  }

  return NextResponse.json({
    id: owner.id,
    name: owner.name,
    email: owner.email,
    cnpj: owner.cnpj,
    phone: owner.phone,
    status: owner.status,
    approvedAt: owner.approvedAt,
    emailVerifiedAt: owner.emailVerifiedAt,
  })
}
