'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

export default function ResetPasswordForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const payload = (await response.json()) as { message?: string; error?: string }

      if (!response.ok) {
        setError(payload.error || 'Não foi possível atualizar sua senha.')
      } else {
        setSuccess(
          payload.message || 'Senha atualizada com sucesso. Você já pode entrar.'
        )
        setPassword('')
        setConfirmPassword('')
      }
    } catch {
      setError('Não foi possível atualizar sua senha.')
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
          <Label htmlFor="reset-password">Nova senha</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="Digite uma senha forte"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 rounded-xl border-[#e7d6c7] bg-white"
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-confirm-password">Confirmar nova senha</Label>
          <Input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Repita sua senha"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
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
              Atualizando...
            </>
          ) : (
            'Salvar nova senha'
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
