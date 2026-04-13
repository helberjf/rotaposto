import type { Metadata } from 'next'
import AuthShell from '@/components/owner/auth-shell'
import LoginForm from '@/components/owner/login-form'

export const metadata: Metadata = {
  title: 'Login de dono de posto | Rotaposto',
  description: 'Acesse sua conta para cadastrar postos, atualizar preços e acompanhar sua operação.',
}

export default function OwnerLoginPage() {
  return (
    <AuthShell
      title="Entrar como dono de posto"
      description="Use o email cadastrado para gerenciar postos, preços e dados operacionais."
    >
      <LoginForm scope="OWNER" />
    </AuthShell>
  )
}
