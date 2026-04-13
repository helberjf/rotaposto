import type { Metadata } from 'next'
import AuthShell from '@/components/owner/auth-shell'
import ForgotPasswordForm from '@/components/owner/forgot-password-form'

export const metadata: Metadata = {
  title: 'Recuperar senha | Rotaposto',
  description: 'Receba por email o link para redefinir a senha da sua conta de parceiro.',
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Esqueceu sua senha?"
      description="Informe o email da conta para receber o link de redefinição."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
