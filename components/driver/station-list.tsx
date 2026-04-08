'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Phone, Share2, ThumbsUp } from 'lucide-react'
import PriceReportDialog from './price-report-dialog'
import { useState } from 'react'

interface Station {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  brand?: string
  phone?: string
  distance?: number
  fuel_prices?: Array<{
    fuelType: string
    price: number
    updatedAt: string
  }>
  source: string
  isVerified: boolean
}

export default function StationList({ stations }: { stations: Station[] }) {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)

  if (!stations.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Nenhuma estação encontrada</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {stations.map((station) => (
          <Card key={station.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{station.name}</CardTitle>
                    {station.isVerified && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-semibold">
                        Verificada
                      </span>
                    )}
                  </div>
                  {station.brand && (
                    <p className="text-xs text-gray-500 mt-1">{station.brand}</p>
                  )}
                </div>
                {station.distance && (
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">{(station.distance / 1000).toFixed(1)} km</p>
                    <p className="text-xs text-gray-500">de distância</p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Address */}
              <div className="flex gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                <p>{station.address}</p>
              </div>

              {/* Phone */}
              {station.phone && (
                <div className="flex gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                  <a href={`tel:${station.phone}`} className="hover:text-blue-600">
                    {station.phone}
                  </a>
                </div>
              )}

              {/* Fuel Prices */}
              {station.fuel_prices && station.fuel_prices.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  {station.fuel_prices.map((fuel) => (
                    <div key={fuel.fuelType} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">{fuel.fuelType}</span>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">R$ {fuel.price.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(fuel.updatedAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedStation(station)}
                >
                  <ThumbsUp className="w-4 h-4 mr-1" />
                  Reportar Preço
                </Button>
                <Button size="sm" variant="ghost" className="flex-1">
                  <Share2 className="w-4 h-4 mr-1" />
                  Compartilhar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedStation && (
        <PriceReportDialog
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
          onSubmit={() => setSelectedStation(null)}
        />
      )}
    </>
  )
}
