'use client'

import { useEffect, useState } from 'react'
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
import { calculateDistance } from '@/lib/geo'

type FuelType = 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'GNV'

const MAX_DISTANCE_KM = 0.5

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
  const [reporterLat, setReporterLat] = useState<number | null>(null)
  const [reporterLng, setReporterLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)

  const tooFar = distanceKm !== null && distanceKm > MAX_DISTANCE_KM

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada pelo seu navegador.')
      setGeoLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setReporterLat(lat)
        setReporterLng(lng)
        setDistanceKm(calculateDistance(lat, lng, station.lat, station.lng))
        setGeoLoading(false)
      },
      () => {
        setError('Não foi possível acessar sua localização. Permita o acesso para atualizar preços.')
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  }, [station.lat, station.lng])

  const ownerPrice = station.owner_prices?.find((item) => item.fuelType === fuelType)
  const communityPrice = station.community_prices?.find(
    (item) => item.fuelType === fuelType
  )

  async function handleSubmit() {
    if (!price) {
      setError('Por favor, informe o preço.')
      return
    }

    const priceNum = parseFloat(price.replace(',', '.'))
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Preço inválido. Use o formato 6,29.')
      return
    }

    if (reporterLat === null || reporterLng === null) {
      setError('Aguarde a localização ser obtida.')
      return
    }

    if (tooFar) {
      setError(`Você precisa estar a no máximo 500m do posto para atualizar o preço. Distância atual: ${((distanceKm ?? 0) * 1000).toFixed(0)}m.`)
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
          price: parseFloat(price.replace(',', '.')),
          reporterLat,
          reporterLng,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error || 'Erro ao editar o preço.')
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
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : 'Erro ao salvar o preço. Tente novamente.'
      )
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
        ) : geoLoading ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Spinner className="size-6" />
            <p className="text-sm text-[#78716c]">Obtendo sua localização…</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tooFar ? (
              <div className="rounded-xl border border-[#fecaca] bg-[#fff1f2] p-3 text-sm text-[#b91c1c]">
                Você está a {((distanceKm ?? 0) * 1000).toFixed(0)}m do posto. É necessário estar a no máximo 500m para atualizar o preço.
              </div>
            ) : distanceKm !== null ? (
              <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[#15803d]">
                Você está a {((distanceKm) * 1000).toFixed(0)}m do posto. Pode atualizar o preço.
              </div>
            ) : null}

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
              <Label htmlFor="price">
                Seu Preço (R$)
                <span className="ml-2 text-xs font-normal text-[#78716c]">
                  Formato: 6,29
                </span>
              </Label>
              <Input
                id="price"
                type="text"
                inputMode="numeric"
                placeholder="6,29"
                value={price}
                maxLength={4}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '').slice(0, 3)
                  if (digits.length === 0) {
                    setPrice('')
                  } else if (digits.length === 1) {
                    setPrice(digits)
                  } else {
                    setPrice(digits[0] + ',' + digits.slice(1))
                  }
                }}
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
                disabled={loading || tooFar || reporterLat === null}
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
