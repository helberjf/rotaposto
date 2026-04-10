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

type FuelType = 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'GNV'

interface StationFuelPrice {
  fuelType: FuelType
  price: number
  updatedAt: string
}

interface StationCommunityPrice extends StationFuelPrice {
  reportCount?: number
}

interface Station {
  id: string
  name: string
  lat: number
  lng: number
  owner_prices?: StationFuelPrice[]
  community_prices?: StationCommunityPrice[]
}

interface PriceReportResult {
  fuelType: FuelType
  communityPrice?: StationCommunityPrice | null
}

export default function PriceReportDialog({
  station,
  onClose,
  onSubmit,
}: {
  station: Station
  onClose: () => void
  onSubmit: (result: PriceReportResult) => void
}) {
  const [fuelType, setFuelType] = useState<FuelType>('GASOLINE')
  const [price, setPrice] = useState('')
  const [reporterLat] = useState(station.lat.toString())
  const [reporterLng] = useState(station.lng.toString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const ownerPrice = station.owner_prices?.find((item) => item.fuelType === fuelType)
  const communityPrice = station.community_prices?.find(
    (item) => item.fuelType === fuelType
  )

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
        throw new Error('Erro ao editar o preço.')
      }

      const payload = (await response.json()) as {
        communityPrice?: StationCommunityPrice | null
      }

      setSuccess(true)
      window.setTimeout(() => {
        onSubmit({
          fuelType,
          communityPrice: payload.communityPrice,
        })
        onClose()
      }, 1500)
    } catch (submitError) {
      console.error(submitError)
      setError('Erro ao salvar o preço. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Preço</DialogTitle>
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
            <p className="font-medium text-[#15803d]">Preço enviado com sucesso.</p>
            <p className="mt-2 text-sm text-[#78716c]">
              A média da comunidade foi atualizada.
            </p>
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
              <Select value={fuelType} onValueChange={(value) => setFuelType(value as FuelType)}>
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e7d6c7] bg-[#fffaf5] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#78716c]">
                  Preço do Dono
                </p>
                {ownerPrice ? (
                  <>
                    <p className="mt-1 text-lg font-semibold text-[#18181b]">
                      R$ {ownerPrice.price.toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs text-[#78716c]">
                      Atualizado em{' '}
                      {new Date(ownerPrice.updatedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[#78716c]">
                    Sem valor oficial informado.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                  Comunidade
                </p>
                {communityPrice ? (
                  <>
                    <p className="mt-1 text-lg font-semibold text-[#0f172a]">
                      R$ {communityPrice.price.toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs text-[#64748b]">
                      {communityPrice.reportCount || 1} reporte
                      {(communityPrice.reportCount || 1) === 1 ? '' : 's'}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[#64748b]">
                    Nenhum valor colaborativo ainda.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Seu Preço (R$)</Label>
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
              Seu envio entra como valor colaborativo e sua localização é anonimizada para proteger sua privacidade.
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
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
