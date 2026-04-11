'use client'

import { useState } from 'react'
import LocationAutocompleteInput from '@/components/location-autocomplete-input'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, LocateFixed, Plus } from 'lucide-react'

interface SuggestedStation {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  brand?: string
  phone?: string
  source: string
  isVerified: boolean
  owner_prices: Array<{
    fuelType: 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'GNV'
    price: number
    updatedAt: string
  }>
  community_prices: Array<{
    fuelType: 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'GNV'
    price: number
    updatedAt: string
    reportCount?: number
  }>
  fuel_prices: Array<{
    fuelType: 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'GNV'
    price: number
    updatedAt: string
  }>
}

interface Coordinates {
  lat: number
  lng: number
}

interface ReverseGeocodeResult extends Coordinates {
  label: string
}

interface NearbyStation {
  id: string
  name: string
  address: string
  brand?: string
  distance: number
}

export default function StationSuggestionForm({
  onCreated,
  actions,
}: {
  onCreated?: (station: SuggestedStation) => void
  actions?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [checkLoading, setCheckLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [nearbyMatches, setNearbyMatches] = useState<NearbyStation[]>([])
  const [confirmedNotDuplicate, setConfirmedNotDuplicate] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    cep: '',
    address: '',
    lat: '',
    lng: '',
    brand: '',
    phone: '',
  })

  function resetForm() {
    setFormData({
      name: '',
      cep: '',
      address: '',
      lat: '',
      lng: '',
      brand: '',
      phone: '',
    })
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target

    setFormData((previous) => {
      if (name === 'address') {
        return { ...previous, address: value, lat: '', lng: '' }
      }

      return { ...previous, [name]: value }
    })
  }

  async function handleCepChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    const formatted =
      digits.length > 5
        ? `${digits.slice(0, 5)}-${digits.slice(5)}`
        : digits
    setFormData((previous) => ({ ...previous, cep: formatted, lat: '', lng: '' }))

    if (digits.length === 8) {
      setCepLoading(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
        const data = (await res.json()) as {
          erro?: boolean
          logradouro?: string
          bairro?: string
          localidade?: string
          uf?: string
        }
        if (!data.erro) {
          const addr = [data.logradouro, data.bairro, data.localidade, data.uf]
            .filter(Boolean)
            .join(', ')
          setFormData((previous) => ({
            ...previous,
            address: previous.address.trim() ? previous.address : addr,
            lat: '',
            lng: '',
          }))
        }
      } catch {
        // ViaCEP indisponível – usuário preenche o endereço manualmente
      } finally {
        setCepLoading(false)
      }
    }
  }

  async function handleUseCurrentLocation() {
    setLocationLoading(true)
    setError('')

    try {
      const coords = await getCurrentPosition()
      const place = await reverseGeocode(coords).catch(() => ({
        ...coords,
        label: 'Minha localização atual',
      }))

      setFormData((previous) => ({
        ...previous,
        address: place.label,
        lat: coords.lat.toFixed(6),
        lng: coords.lng.toFixed(6),
      }))
    } catch (locationError) {
      console.error(locationError)
      setError('Não foi possível usar sua localização agora.')
    } finally {
      setLocationLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    // ── Step 1: resolve coordinates ──────────────────────────────────
    let resolvedLat = parseFloat(formData.lat)
    let resolvedLng = parseFloat(formData.lng)

    if (isNaN(resolvedLat) || isNaN(resolvedLng)) {
      setLoading(true)
      try {
        const query = [formData.address.trim(), formData.cep.trim()]
          .filter(Boolean)
          .join(', ')
        const geoResponse = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        if (!geoResponse.ok) {
          throw new Error(
            'Não foi possível localizar o endereço. Verifique o CEP e o endereço informados.'
          )
        }
        const geoResult = (await geoResponse.json()) as { lat: number; lng: number }
        resolvedLat = geoResult.lat
        resolvedLng = geoResult.lng
        setFormData((prev) => ({
          ...prev,
          lat: resolvedLat.toFixed(6),
          lng: resolvedLng.toFixed(6),
        }))
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Não foi possível localizar o endereço.'
        )
        setLoading(false)
        return
      } finally {
        setLoading(false)
      }
    }

    // ── Step 2: check for nearby stations (unless user already confirmed) ──
    if (!confirmedNotDuplicate) {
      setCheckLoading(true)
      try {
        const res = await fetch(
          `/api/stations/suggest/check?lat=${resolvedLat}&lng=${resolvedLng}`
        )
        const nearby = (await res.json()) as NearbyStation[]
        if (Array.isArray(nearby) && nearby.length > 0) {
          setNearbyMatches(nearby)
          setCheckLoading(false)
          return // pause — show confirmation UI
        }
      } catch {
        // if check fails, proceed anyway
      } finally {
        setCheckLoading(false)
      }
    }

    // ── Step 3: submit to moderation queue ───────────────────────────
    setLoading(true)
    try {
      const response = await fetch('/api/stations/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address,
          lat: resolvedLat,
          lng: resolvedLng,
          brand: formData.brand || null,
          phone: formData.phone || null,
        }),
      })

      const payload = (await safeJson<{ error?: string }>(response)) ?? {
        error: 'Erro desconhecido.',
      }

      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível sugerir o posto.')
      }

      setSuccess(
        'Sugestão enviada! O posto aparecerá no mapa após revisão.'
      )
      resetForm()
      setNearbyMatches([])
      setConfirmedNotDuplicate(false)

      window.setTimeout(() => {
        setOpen(false)
        setSuccess('')
      }, 2500)
    } catch (submitError) {
      console.error(submitError)
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : 'Não foi possível sugerir o posto.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-[#f5c8a6] bg-[#fff7f0] px-3 text-[#c2410c] hover:bg-[#ffeddc]"
            >
              <Plus className="mr-1.5 size-4" />
              Adicionar posto
              {open ? (
                <ChevronUp className="ml-1.5 size-4" />
              ) : (
                <ChevronDown className="ml-1.5 size-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent
          className={cn(
            'overflow-hidden rounded-[20px] border border-[#f3ddc9] bg-[#fff8f1] transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'
          )}
        >
          <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold tracking-tight text-[#18181b]">
                  Sugerir novo posto
                </h3>
                <p className="mt-1 text-sm text-[#78716c]">
                  Envie um posto que ainda não aparece no mapa.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 rounded-full px-3 text-[#78716c]"
              >
                Fechar
              </Button>
            </div>

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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="suggested-station-name">Nome do posto *</Label>
                <Input
                  id="suggested-station-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ex: Posto Central"
                  disabled={loading}
                  required
                  className="h-11 rounded-xl border-[#e7d6c7] bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="suggested-station-brand">Marca</Label>
                <Input
                  id="suggested-station-brand"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  placeholder="Ex: Shell, Ipiranga"
                  disabled={loading}
                  className="h-11 rounded-xl border-[#e7d6c7] bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="suggested-station-cep">CEP *</Label>
                <div className="relative">
                  <Input
                    id="suggested-station-cep"
                    name="cep"
                    value={formData.cep}
                    onChange={(e) => void handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    disabled={loading}
                    required
                    maxLength={9}
                    inputMode="numeric"
                    className="h-11 rounded-xl border-[#e7d6c7] bg-white pr-9"
                  />
                  {cepLoading ? (
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#78716c]">
                      <Spinner className="size-4" />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="suggested-station-phone">Telefone</Label>
                <Input
                  id="suggested-station-phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(11) 99999-9999"
                  disabled={loading}
                  className="h-11 rounded-xl border-[#e7d6c7] bg-white"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="suggested-station-address">Endereço completo *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleUseCurrentLocation()}
                    disabled={loading || locationLoading}
                    className="h-8 rounded-full border-[#e7d6c7] bg-white px-3 text-xs"
                  >
                    {locationLoading ? (
                      <>
                        <Spinner className="mr-1.5 size-3.5" />
                        Localizando...
                      </>
                    ) : (
                      <>
                        <LocateFixed className="mr-1.5 size-3.5" />
                        Minha localização
                      </>
                    )}
                  </Button>
                </div>

                <LocationAutocompleteInput
                  id="suggested-station-address"
                  name="address"
                  value={formData.address}
                  placeholder="Ex: Rua das Flores, 123, Bairro, Cidade – SP"
                  disabled={loading}
                  onValueChange={(value) =>
                    setFormData((previous) => ({
                      ...previous,
                      address: value,
                      lat: '',
                      lng: '',
                    }))
                  }
                  onLocationSelect={(suggestion) =>
                    setFormData((previous) => ({
                      ...previous,
                      address: suggestion.label,
                      lat: suggestion.lat.toFixed(6),
                      lng: suggestion.lng.toFixed(6),
                    }))
                  }
                  inputClassName="h-11 rounded-xl border-[#e7d6c7] bg-white"
                />
                <p className="text-xs text-[#78716c]">
                  Selecione uma sugestão para maior precisão, ou preencha o CEP para localização automática.
                </p>
              </div>
            </div>

            {/* ── Nearby station confirmation ────────────────────────────── */}
            {nearbyMatches.length > 0 && !confirmedNotDuplicate ? (
              <div className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4 space-y-3">
                <p className="text-sm font-semibold text-[#92400e]">
                  Encontramos postos próximos ao endereço. É um deles?
                </p>
                <div className="space-y-2">
                  {nearbyMatches.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-[#fde68a] bg-white px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#18181b]">{m.name}</p>
                        <p className="truncate text-xs text-[#78716c] mt-0.5">{m.address}</p>
                        <p className="text-xs text-[#78716c]">{m.distance} m de distância</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNearbyMatches([])
                          setOpen(false)
                        }}
                        className="h-8 shrink-0 rounded-xl border-[#fde68a] text-xs"
                      >
                        Sim, é esse
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setConfirmedNotDuplicate(true)
                    setNearbyMatches([])
                  }}
                  className="w-full h-9 rounded-xl bg-[#f97316] text-white hover:bg-[#ea6a12] text-xs"
                >
                  Não, é um posto diferente — continuar
                </Button>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-[#78716c]">
                A sugestão será revisada antes de aparecer no mapa.
              </p>
              <Button
                type="submit"
                disabled={
                  loading ||
                  locationLoading ||
                  checkLoading ||
                  (nearbyMatches.length > 0 && !confirmedNotDuplicate)
                }
                className="h-10 rounded-xl bg-[#f97316] px-4 text-white hover:bg-[#ea6a12]"
              >
                {loading || checkLoading ? (
                  <>
                    <Spinner className="mr-2 size-4" />
                    {checkLoading ? 'Verificando...' : 'Enviando...'}
                  </>
                ) : (
                  'Enviar para revisão'
                )}
              </Button>
            </div>
          </form>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => reject(new Error('Não foi possível acessar sua localização.')),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    )
  })
}

async function reverseGeocode(coords: Coordinates): Promise<ReverseGeocodeResult> {
  const response = await fetch(
    `/api/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`
  )

  if (!response.ok) {
    throw new Error('Não foi possível identificar sua localização.')
  }

  return response.json() as Promise<ReverseGeocodeResult>
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}
