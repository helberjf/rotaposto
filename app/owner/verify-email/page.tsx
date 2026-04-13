import type { Metadata } from 'next'
import AuthShell from '@/components/owner/auth-shell'
import VerifyEmailPanel from '@/components/owner/verify-email-panel'

export const metadata: Metadata = {
  title: 'Confirmar email | Rotaposto',
  description: 'Confirme o email da sua conta para liberar a análise do cadastro.',
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token || ''

  return (
    <AuthShell
      title="Confirmação de email"
      description="Estamos validando o link enviado para a sua caixa de entrada."
    >
      {token ? (
        <VerifyEmailPanel token={token} />
      ) : (
        <div className="rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-4 text-sm text-[#b91c1c]">
          O link de confirmação está incompleto ou inválido.
        </div>
      )}
    </AuthShell>
  )
}
