'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Phone, Edit2, DollarSign } from 'lucide-react'
import PriceForm from './price-form'

interface FuelPrice {
  id?: string
  stationId?: string
  fuelType: string
  price: number
  updatedAt: string
}

interface Station {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  brand?: string
  phone?: string
  fuel_prices?: FuelPrice[]
}

export default function StationCard({
  station,
  onEdit,
}: {
  station: Station
  onEdit: () => void
}) {
  const [showPriceForm, setShowPriceForm] = useState(false)
  const [prices, setPrices] = useState<FuelPrice[]>(station.fuel_prices || [])

  const handlePriceUpdated = (newPrice: FuelPrice) => {
    setPrices((prev) => {
      const existing = prev.findIndex((p) => p.fuelType === newPrice.fuelType)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = newPrice
        return updated
      }
      return [...prev, newPrice]
    })
    setShowPriceForm(false)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{station.name}</CardTitle>
            {station.brand && (
              <p className="text-xs text-gray-500 mt-1">{station.brand}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
          <p>{station.address}</p>
        </div>

        {station.phone && (
          <div className="flex gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
            <a href={`tel:${station.phone}`} className="hover:text-blue-600">
              {station.phone}
            </a>
          </div>
        )}

        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <p>
            Lat: {station.lat.toFixed(4)} | Lng: {station.lng.toFixed(4)}
          </p>
        </div>

        {prices.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 space-y-2">
            {prices.map((fuel) => (
              <div
                key={fuel.fuelType}
                className="flex justify-between items-center text-sm"
              >
                <span className="font-medium text-gray-700">{fuel.fuelType}</span>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    R$ {fuel.price.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {showPriceForm && (
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <PriceForm
              stationId={station.id}
              onSuccess={handlePriceUpdated}
              onCancel={() => setShowPriceForm(false)}
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {!showPriceForm && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setShowPriceForm(true)}
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Atualizar preço
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={onEdit}
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Editar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
