'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const payload = (await response.json()) as { message?: string; error?: string }

      if (!response.ok) {
        setError(payload.error || 'Não foi possível processar seu pedido.')
      } else {
        setSuccess(
          payload.message ||
            'Se existir uma conta com esse email, enviaremos um link para redefinir a senha.'
        )
      }
    } catch {
      setError('Não foi possível processar seu pedido.')
    } finally {
      setLoading(false)
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
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="contato@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 rounded-xl border-[#e7d6c7] bg-white"
            disabled={loading}
            required
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-[#18181b] text-white hover:bg-[#27272a]"
        >
          {loading ? (
            <>
              <Spinner className="mr-2 size-4" />
              Enviando...
            </>
          ) : (
            'Enviar link'
          )}
        </Button>
      </form>

      <div className="pt-2 text-center text-sm text-[#78716c]">
        <Link href="/owner/login" className="text-[#2563eb] underline">
          Voltar para o login
        </Link>
      </div>
    </div>
  )
}
