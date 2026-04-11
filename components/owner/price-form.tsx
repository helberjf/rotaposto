'use client'

import { useState } from 'react'
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

interface FuelPrice {
  id: string
  stationId: string
  fuelType: string
  price: number
  updatedAt: string
}

export default function PriceForm({
  stationId,
  onSuccess,
  onCancel,
}: {
  stationId: string
  onSuccess: (price: FuelPrice) => void
  onCancel: () => void
}) {
  const [fuelType, setFuelType] = useState('GASOLINE')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!price) {
      setError('Por favor, informe o preço')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/owner/stations/${stationId}/prices`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fuelType,
          price: parseFloat(price),
        }),
      })

      if (!response.ok) throw new Error('Erro ao atualizar preço')

      const result: FuelPrice = await response.json()
      onSuccess(result)
    } catch (err) {
      setError('Erro ao atualizar preço. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="fuel" className="text-xs">
          Combustível
        </Label>
        <Select value={fuelType} onValueChange={setFuelType}>
          <SelectTrigger className="h-8">
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

      <div className="space-y-1">
        <Label htmlFor="price" className="text-xs">
          Preço (R$)
        </Label>
        <Input
          id="price"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          step="0.01"
          disabled={loading}
          className="h-8"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 h-8 text-xs"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={loading}
          className="flex-1 h-8 text-xs"
        >
          {loading ? (
            <>
              <Spinner className="w-3 h-3 mr-1" />
              Salvando...
            </>
          ) : (
            'Salvar'
          )}
        </Button>
      </div>
    </form>
  )
}
