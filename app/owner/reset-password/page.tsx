import type { Metadata } from 'next'
import AuthShell from '@/components/owner/auth-shell'
import ResetPasswordForm from '@/components/owner/reset-password-form'

export const metadata: Metadata = {
  title: 'Redefinir senha | Rotaposto',
  description: 'Defina uma nova senha para continuar acessando o painel do posto.',
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token || ''

  return (
    <AuthShell
      title="Definir nova senha"
      description="Escolha uma nova senha forte para proteger o acesso ao seu painel."
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-4 text-sm text-[#b91c1c]">
          O link de redefinição está incompleto ou inválido.
        </div>
      )}
    </AuthShell>
  )
}
