import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { AUTH_ERROR_CODES } from '@/lib/auth/error-codes'
import {
  authenticateAdmin,
  getStationOwnerByEmail,
  loginSchema,
  verifyPassword,
} from '@/lib/auth'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
        scope: { label: 'Escopo', type: 'text' },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials)

        if (!parsed.success) {
          throw new Error(AUTH_ERROR_CODES.invalidCredentials)
        }

        const { email, password, scope } = parsed.data

        const adminUser = await authenticateAdmin(email, password)
        if (adminUser) {
          if (scope === 'OWNER') {
            throw new Error(AUTH_ERROR_CODES.ownerOnly)
          }

          return adminUser
        }

        const owner = await getStationOwnerByEmail(email)
        if (!owner) {
          throw new Error(AUTH_ERROR_CODES.invalidCredentials)
        }

        const passwordMatch = await verifyPassword(password, owner.password)
        if (!passwordMatch) {
          throw new Error(AUTH_ERROR_CODES.invalidCredentials)
        }

        if (scope === 'ADMIN' && owner.role !== 'ADMIN') {
          throw new Error(AUTH_ERROR_CODES.adminOnly)
        }

        if (scope === 'OWNER' && owner.role === 'ADMIN') {
          throw new Error(AUTH_ERROR_CODES.ownerOnly)
        }

        if (!owner.emailVerifiedAt) {
          throw new Error(AUTH_ERROR_CODES.emailNotVerified)
        }

        if (owner.status === 'PENDING_APPROVAL') {
          throw new Error(AUTH_ERROR_CODES.approvalPending)
        }

        if (owner.status === 'REJECTED') {
          throw new Error(AUTH_ERROR_CODES.approvalRejected)
        }

        if (owner.status === 'BLOCKED') {
          throw new Error(AUTH_ERROR_CODES.accountBlocked)
        }

        return {
          id: owner.id,
          email: owner.email,
          name: owner.name,
          role: owner.role,
          status: owner.status,
        }
      },
    }),
  ],
  pages: {
    signIn: '/owner/login',
    error: '/owner/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user.role as 'OWNER' | 'ADMIN') || 'OWNER'
        token.status =
          (user.status as
            | 'PENDING_EMAIL_VERIFICATION'
            | 'PENDING_APPROVAL'
            | 'ACTIVE'
            | 'REJECTED'
            | 'BLOCKED') || 'ACTIVE'
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.status = token.status
      }

      return session
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
