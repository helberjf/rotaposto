'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { AUTH_ERROR_CODES } from '@/lib/auth/error-codes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

function getAuthErrorMessage(error: string, scope: 'OWNER' | 'ADMIN') {
  switch (error) {
    case AUTH_ERROR_CODES.emailNotVerified:
      return 'Seu email ainda não foi confirmado. Reenvie o link abaixo.'
    case AUTH_ERROR_CODES.approvalPending:
      return 'Seu cadastro já foi confirmado por email e agora aguarda aprovação do admin.'
    case AUTH_ERROR_CODES.approvalRejected:
      return 'Seu cadastro foi analisado, mas não foi aprovado neste momento.'
    case AUTH_ERROR_CODES.accountBlocked:
      return 'Sua conta está bloqueada. Fale com o suporte para revisar o acesso.'
    case AUTH_ERROR_CODES.adminOnly:
      return 'Use uma conta de administrador para entrar nesta área.'
    case AUTH_ERROR_CODES.ownerOnly:
      return 'Use a entrada de dono de posto para acessar esta conta.'
    default:
      return scope === 'ADMIN'
        ? 'Não foi possível autenticar este administrador.'
        : 'Email ou senha incorretos.'
  }
}

export default function LoginForm({
  scope,
}: {
  scope: 'OWNER' | 'ADMIN'
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [success, setSuccess] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const callbackUrl =
    scope === 'ADMIN' ? '/owner/dashboard?tab=owner-approvals' : '/owner/dashboard'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setErrorCode('')
    setSuccess('')

    const result = await signIn('credentials', {
      email,
      password,
      scope,
      redirect: false,
      callbackUrl,
    })

    if (!result?.ok) {
      const nextErrorCode = result?.error || ''
      setErrorCode(nextErrorCode)
      setError(getAuthErrorMessage(nextErrorCode, scope))
      setLoading(false)
      return
    }

    router.push(callbackUrl)
  }

  async function handleResendVerification() {
    if (!email) {
      setError('Informe o email para reenviar a confirmação.')
      return
    }

    setResending(true)
    setSuccess('')

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const payload = (await response.json()) as { message?: string; error?: string }

      if (!response.ok) {
        setError(payload.error || 'Não foi possível reenviar o link agora.')
      } else {
        setSuccess(payload.message || 'Novo link enviado com sucesso.')
      }
    } catch {
      setError('Não foi possível reenviar o link agora.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#15803d]">
            {success}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`${scope}-email`}>Email</Label>
          <Input
            id={`${scope}-email`}
            type="email"
            autoComplete="email"
            placeholder="contato@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
            className="h-11 rounded-xl border-[#e7d6c7] bg-white"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${scope}-password`}>Senha</Label>
          <Input
            id={`${scope}-password`}
            type="password"
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            className="h-11 rounded-xl border-[#e7d6c7] bg-white"
            required
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-[#f97316] text-white hover:bg-[#ea6a12]"
        >
          {loading ? (
            <>
              <Spinner className="mr-2 size-4" />
              Entrando...
            </>
          ) : scope === 'ADMIN' ? (
            'Entrar como admin'
          ) : (
            'Entrar'
          )}
        </Button>
      </form>

      {errorCode === AUTH_ERROR_CODES.emailNotVerified ? (
        <Button
          type="button"
          variant="outline"
          disabled={resending}
          onClick={() => void handleResendVerification()}
          className="h-10 w-full rounded-xl border-[#e7d6c7] bg-white"
        >
          {resending ? (
            <>
              <Spinner className="mr-2 size-4" />
              Reenviando...
            </>
          ) : (
            'Reenviar email de confirmação'
          )}
        </Button>
      ) : null}

      <div className="space-y-1 pt-2 text-center text-sm text-[#78716c]">
        {scope === 'OWNER' ? (
          <>
            <p>
              <Link href="/owner/forgot-password" className="text-[#2563eb] underline">
                Esqueceu sua senha?
              </Link>
            </p>
            <p>
              Ainda não tem conta?{' '}
              <Link href="/owner/register" className="text-[#2563eb] underline">
                Criar conta
              </Link>
            </p>
          </>
        ) : (
          <p>
            Precisa acessar como parceiro?{' '}
            <Link href="/owner/login" className="text-[#2563eb] underline">
              Ir para o login de donos
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
