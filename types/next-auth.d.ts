import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    role: 'OWNER' | 'ADMIN'
    status:
      | 'PENDING_EMAIL_VERIFICATION'
      | 'PENDING_APPROVAL'
      | 'ACTIVE'
      | 'REJECTED'
      | 'BLOCKED'
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: 'OWNER' | 'ADMIN'
      status:
        | 'PENDING_EMAIL_VERIFICATION'
        | 'PENDING_APPROVAL'
        | 'ACTIVE'
        | 'REJECTED'
        | 'BLOCKED'
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'OWNER' | 'ADMIN'
    status:
      | 'PENDING_EMAIL_VERIFICATION'
      | 'PENDING_APPROVAL'
      | 'ACTIVE'
      | 'REJECTED'
      | 'BLOCKED'
  }
}
