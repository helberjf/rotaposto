'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Fuel } from 'lucide-react'
import { registerOwner } from '@/app/actions/auth'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas nÃ£o correspondem')
      return
    }

    if (password.length < 8) {
      setError('A senha deve ter no mÃ­nimo 8 caracteres')
      return
    }

    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await registerOwner(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    const signInResult = await signIn('credentials', {
      email: formData.get('email'),
      password,
      redirect: false,
    })

    if (!signInResult?.ok) {
      setError('Conta criada, mas o login automÃ¡tico falhou')
      setLoading(false)
      return
    }

    router.push('/owner/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
            <Fuel className="w-8 h-8 text-white" />
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">FuelRoute</CardTitle>
            <CardDescription>Criar conta de proprietÃ¡rio</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="JoÃ£o Silva"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  required
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Registrando...
                  </>
                ) : (
                  'Registrar'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              <p className="text-gray-600">
                JÃ¡ tem uma conta?{' '}
                <Link href="/owner/login" className="text-blue-600 hover:underline font-semibold">
                  Entre aqui
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
