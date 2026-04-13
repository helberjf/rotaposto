import type { Metadata } from 'next'
import AuthShell from '@/components/owner/auth-shell'
import RegisterForm from '@/components/owner/register-form'

export const metadata: Metadata = {
  title: 'Criar conta de parceiro | Rotaposto',
  description: 'Cadastre seu posto com dados mais completos, confirme o email e aguarde a aprovação do admin.',
}

export default function OwnerRegisterPage() {
  return (
    <AuthShell
      title="Criar conta de parceiro"
      description="Preencha os dados do responsável e da empresa para liberar o acesso ao painel do posto."
    >
      <RegisterForm />
    </AuthShell>
  )
}
