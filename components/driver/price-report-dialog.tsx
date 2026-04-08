'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  const [reporterLat, setReporterLat] = useState(station.lat.toString())
  const [reporterLng, setReporterLng] = useState(station.lng.toString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!price) {
      setError('Por favor, informe o preço')
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

      if (!response.ok) throw new Error('Erro ao reportar preço')

      setSuccess(true)
      setTimeout(() => {
        onSubmit()
        onClose()
      }, 1500)
    } catch (err) {
      setError('Erro ao reportar. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar Preço</DialogTitle>
          <DialogDescription>{station.name}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-700 font-medium">Preço reportado com sucesso!</p>
            <p className="text-sm text-gray-600 mt-2">Obrigado por contribuir</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fuelType">Tipo de Combustível</Label>
              <Select value={fuelType} onValueChange={setFuelType}>
                <SelectTrigger>
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
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                type="number"
                step="0.01"
              />
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
              <p>Sua localização será anonimizada para proteção de privacidade</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
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
