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

export default function StationSuggestionForm({
  onCreated,
}: {
  onCreated?: (station: SuggestedStation) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lat: '',
    lng: '',
    brand: '',
    phone: '',
  })

  function resetForm() {
    setFormData({
      name: '',
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
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/stations/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
          brand: formData.brand || null,
          phone: formData.phone || null,
        }),
      })

      const payload = (await safeJson<{
        error?: string
        station?: SuggestedStation
      }>(response)) ?? { error: 'Não foi possível sugerir o posto.' }

      if (!response.ok || !payload.station) {
        throw new Error(payload.error || 'Não foi possível sugerir o posto.')
      }

      onCreated?.(payload.station)
      setSuccess('Posto sugerido com sucesso.')
      resetForm()

      window.setTimeout(() => {
        setOpen(false)
        setSuccess('')
      }, 1400)
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
        <div className="flex justify-end">
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

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="suggested-station-address">Endereço *</Label>
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
                  placeholder="Digite o endereço do posto"
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
                  Selecione uma sugestão para preencher a localização com precisão.
                </p>
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

              <div className="space-y-2">
                <Label htmlFor="suggested-station-lat">Coordenadas</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="suggested-station-lat"
                    name="lat"
                    type="number"
                    step="0.000001"
                    value={formData.lat}
                    onChange={handleChange}
                    placeholder="Latitude"
                    disabled={loading}
                    required
                    className="h-11 rounded-xl border-[#e7d6c7] bg-white"
                  />
                  <Input
                    name="lng"
                    type="number"
                    step="0.000001"
                    value={formData.lng}
                    onChange={handleChange}
                    placeholder="Longitude"
                    disabled={loading}
                    required
                    className="h-11 rounded-xl border-[#e7d6c7] bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-[#78716c]">
                O posto entra como sugestão colaborativa e pode receber preços depois.
              </p>
              <Button
                type="submit"
                disabled={loading || locationLoading}
                className="h-10 rounded-xl bg-[#f97316] px-4 text-white hover:bg-[#ea6a12]"
              >
                {loading ? (
                  <>
                    <Spinner className="mr-2 size-4" />
                    Enviando...
                  </>
                ) : (
                  'Salvar sugestão'
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
