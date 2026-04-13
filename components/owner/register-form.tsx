'use client'

import { useState } from 'react'
import Link from 'next/link'
import { registerOwner } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

export default function RegisterForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const formData = new FormData(event.currentTarget)
    const result = await registerOwner(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(
      result?.message ||
        'Cadastro enviado. Confira seu email para confirmar o acesso.'
    )
    event.currentTarget.reset()
    setLoading(false)
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
          <Label htmlFor="owner-name">Nome completo do responsável</Label>
          <Input
            id="owner-name"
            name="name"
            autoComplete="name"
            placeholder="Ex: João Carlos Silva"
            className="h-11 rounded-xl border-[#e7d6c7] bg-white"
            disabled={loading}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="owner-cnpj">CNPJ</Label>
            <Input
              id="owner-cnpj"
              name="cnpj"
              placeholder="00.000.000/0000-00"
              className="h-11 rounded-xl border-[#e7d6c7] bg-white"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner-phone">Telefone</Label>
            <Input
              id="owner-phone"
              name="phone"
              autoComplete="tel"
              placeholder="(32) 99999-0000"
              className="h-11 rounded-xl border-[#e7d6c7] bg-white"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner-email">Email</Label>
          <Input
            id="owner-email"
            name="email"
            autoComplete="email"
            type="email"
            placeholder="contato@empresa.com"
            className="h-11 rounded-xl border-[#e7d6c7] bg-white"
            disabled={loading}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="owner-password">Senha</Label>
            <Input
              id="owner-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Crie uma senha forte"
              className="h-11 rounded-xl border-[#e7d6c7] bg-white"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner-confirm-password">Confirmar senha</Label>
            <Input
              id="owner-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a senha"
              className="h-11 rounded-xl border-[#e7d6c7] bg-white"
              disabled={loading}
              required
            />
          </div>
        </div>

        <p className="text-xs leading-5 text-[#78716c]">
          Depois do cadastro, vamos confirmar o email e liberar o acesso após a análise do admin.
        </p>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-[#f97316] text-white hover:bg-[#ea6a12]"
        >
          {loading ? (
            <>
              <Spinner className="mr-2 size-4" />
              Criando conta...
            </>
          ) : (
            'Criar conta'
          )}
        </Button>
      </form>

      <div className="pt-2 text-center text-sm text-[#78716c]">
        Já tem conta?{' '}
        <Link href="/owner/login" className="text-[#2563eb] underline">
          Entrar agora
        </Link>
      </div>
    </div>
  )
}
