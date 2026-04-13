'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export default function VerifyEmailPanel({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function verify() {
      try {
        const response = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`
        )
        const payload = (await response.json()) as {
          message?: string
          error?: string
        }

        if (cancelled) {
          return
        }

        if (!response.ok) {
          setError(payload.error || 'Não foi possível confirmar seu email.')
        } else {
          setMessage(
            payload.message ||
              'Email confirmado com sucesso. Você já pode seguir para o login.'
          )
        }
      } catch {
        if (!cancelled) {
          setError('Não foi possível confirmar seu email.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void verify()

    return () => {
      cancelled = true
    }
  }, [token])

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#f3ddc9] bg-[#fff8f1] px-4 py-6 text-center text-sm text-[#78716c]">
        <div className="flex items-center justify-center gap-2">
          <Spinner className="size-4" />
          Confirmando seu email...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-4 text-sm text-[#b91c1c]">
          {error}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-4 text-sm text-[#15803d]">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button asChild className="h-11 rounded-xl bg-[#f97316] text-white hover:bg-[#ea6a12]">
          <Link href="/owner/login">Ir para o login</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl border-[#e7d6c7] bg-white">
          <Link href="/driver">Voltar para a busca</Link>
        </Button>
      </div>
    </div>
  )
}
