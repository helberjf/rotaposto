import type { Session } from 'next-auth'

export function isAdminSession(session: Session | null | undefined) {
  return session?.user?.role === 'ADMIN'
}

export function isOwnerSession(session: Session | null | undefined) {
  return session?.user?.role === 'OWNER' && session.user.status === 'ACTIVE'
}
