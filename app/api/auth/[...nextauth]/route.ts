import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getStationOwnerByEmail, verifyPassword } from '@/lib/auth'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e senha são obrigatórios')
        }

        const owner = await getStationOwnerByEmail(credentials.email)
        if (!owner) {
          throw new Error('Email ou senha incorretos')
        }

        const passwordMatch = await verifyPassword(
          credentials.password,
          owner.password
        )
        if (!passwordMatch) {
          throw new Error('Email ou senha incorretos')
        }

        return {
          id: owner.id,
          email: owner.email,
          name: owner.name,
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
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
