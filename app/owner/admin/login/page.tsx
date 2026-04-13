import type { Metadata } from 'next'
import AuthShell from '@/components/owner/auth-shell'
import LoginForm from '@/components/owner/login-form'

export const metadata: Metadata = {
  title: 'Login admin | Rotaposto',
  description: 'Acesse a área administrativa para aprovar novos parceiros e revisar sugestões.',
}

export default function AdminLoginPage() {
  return (
    <AuthShell
      title="Entrar como admin"
      description="Use as credenciais administrativas para aprovar contas de donos de posto e revisar o sistema."
    >
      <LoginForm scope="ADMIN" />
    </AuthShell>
  )
}
