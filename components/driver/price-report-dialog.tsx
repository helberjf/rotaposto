'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'

interface Station {
  id: string
  name: string
  lat: number
  lng: number
}

export default function PriceReportDialog({
  station,
  onClose,
  onSubmit,
}: {
  station: Station
  onClose: () => void
  onSubmit: () => void
}) {
  const [fuelType, setFuelType] = useState('GASOLINE')
  const [price, setPrice] = useState('')
  const [reporterLat] = useState(station.lat.toString())
  const [reporterLng] = useState(station.lng.toString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    if (!price) {
      setError('Por favor, informe o preço.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/prices/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: station.id,
          fuelType,
          price: parseFloat(price),
          reporterLat: parseFloat(reporterLat),
          reporterLng: parseFloat(reporterLng),
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao reportar preço.')
      }

      setSuccess(true)
      window.setTimeout(() => {
        onSubmit()
        onClose()
      }, 1500)
    } catch (submitError) {
      console.error(submitError)
      setError('Erro ao reportar o preço. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar Preço</DialogTitle>
          <DialogDescription>{station.name}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#ecfdf3]">
              <svg
                className="h-6 w-6 text-[#16a34a]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="font-medium text-[#15803d]">Preço reportado com sucesso.</p>
            <p className="mt-2 text-sm text-[#78716c]">Obrigado por contribuir.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error ? (
              <div className="rounded-xl border border-[#fecaca] bg-[#fff1f2] p-3 text-sm text-[#b91c1c]">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="fuelType">Tipo de Combustível</Label>
              <Select value={fuelType} onValueChange={setFuelType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GASOLINE">Gasolina</SelectItem>
                  <SelectItem value="ETHANOL">Etanol</SelectItem>
                  <SelectItem value="DIESEL">Diesel</SelectItem>
                  <SelectItem value="GNV">GNV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>

            <div className="rounded-xl bg-[#fcfbf8] p-3 text-xs text-[#78716c]">
              Sua localização será anonimizada para proteger sua privacidade.
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSubmit()}
                disabled={loading}
                className="flex-1 bg-[#f97316] text-white hover:bg-[#ea6a12]"
              >
                {loading ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Enviando...
                  </>
                ) : (
                  'Enviar'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
