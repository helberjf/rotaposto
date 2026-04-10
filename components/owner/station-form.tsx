'use client'

import { useState } from 'react'
import LocationAutocompleteInput from '@/components/location-autocomplete-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

interface Station {
  id: string
  name: string
  cnpj?: string
  address: string
  lat: number
  lng: number
  brand?: string
  phone?: string
}

export default function StationForm({
  station,
  onSuccess,
}: {
  station?: Station
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: station?.name || '',
    cnpj: station?.cnpj || '',
    address: station?.address || '',
    lat: station?.lat?.toString() || '',
    lng: station?.lng?.toString() || '',
    brand: station?.brand || '',
    phone: station?.phone || '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target

    setFormData((prev) => {
      if (name === 'address') {
        return { ...prev, address: value, lat: '', lng: '' }
      }

      return { ...prev, [name]: value }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const url = station ? `/api/owner/stations/${station.id}` : '/api/owner/stations'
      const method = station ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          cnpj: formData.cnpj || null,
          address: formData.address,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
          brand: formData.brand || null,
          phone: formData.phone || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao salvar estação')
      }

      onSuccess()
    } catch (submitError) {
      console.error(submitError)
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nome da Estação *</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            name="cnpj"
            value={formData.cnpj}
            onChange={handleChange}
            placeholder="00.000.000/0000-00"
            disabled={loading}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Endereço *</Label>
          <LocationAutocompleteInput
            id="address"
            name="address"
            value={formData.address}
            placeholder="Digite o endereço do posto"
            disabled={loading}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, address: value, lat: '', lng: '' }))
            }
            onLocationSelect={(suggestion) =>
              setFormData((prev) => ({
                ...prev,
                address: suggestion.label,
                lat: suggestion.lat.toFixed(6),
                lng: suggestion.lng.toFixed(6),
              }))
            }
          />
          <p className="text-xs text-gray-500">
            Selecione uma sugestão para preencher latitude e longitude automaticamente.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lat">Latitude *</Label>
          <Input
            id="lat"
            name="lat"
            type="number"
            step="0.00001"
            value={formData.lat}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lng">Longitude *</Label>
          <Input
            id="lng"
            name="lng"
            type="number"
            step="0.00001"
            value={formData.lng}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand">Marca</Label>
          <Input
            id="brand"
            name="brand"
            value={formData.brand}
            onChange={handleChange}
            placeholder="ex: Shell, Petrobras"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="(11) 99999-9999"
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Salvando...
            </>
          ) : (
            'Salvar Estação'
          )}
        </Button>
      </div>
    </form>
  )
}
