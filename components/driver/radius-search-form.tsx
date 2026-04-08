'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { MapPin, Navigation } from 'lucide-react'

interface SearchResult {
  stations: Array<Record<string, unknown>>
  center?: [number, number]
}

export default function RadiusSearchForm({
  onSearch,
  isLoading,
}: {
  onSearch: (result: SearchResult) => void
  isLoading: boolean
}) {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState(5000)
  const [geoLoading, setGeoLoading] = useState(false)
  const [error, setError] = useState('')

  const getCurrentLocation = () => {
    setGeoLoading(true)
    setError('')

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setLat(latitude.toString())
          setLng(longitude.toString())
          setGeoLoading(false)
        },
        () => {
          setError('NÃ£o foi possÃ­vel obter sua localizaÃ§Ã£o')
          setGeoLoading(false)
        }
      )
    } else {
      setError('GeolocalizaÃ§Ã£o nÃ£o suportada')
      setGeoLoading(false)
    }
  }

  const handleSearch = useCallback(async () => {
    if (!lat || !lng) {
      setError('Por favor, defina sua localizaÃ§Ã£o')
      return
    }

    try {
      setError('')
      const response = await fetch(
        `/api/stations/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
      )

      if (!response.ok) throw new Error('Erro ao buscar estaÃ§Ãµes')

      const stations = await response.json()
      onSearch({
        stations,
        center: [parseFloat(lat), parseFloat(lng)],
      })
    } catch (err) {
      setError('Erro ao buscar estaÃ§Ãµes. Tente novamente.')
      console.error(err)
    }
  }, [lat, lng, onSearch, radius])

  useEffect(() => {
    if (lat && lng) {
      void handleSearch()
    }
  }, [handleSearch, lat, lng])

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="lat">Latitude</Label>
          <Input
            id="lat"
            placeholder="-23.5505"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            type="number"
            step="0.00001"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lng">Longitude</Label>
          <Input
            id="lng"
            placeholder="-46.6333"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            type="number"
            step="0.00001"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Raio de Busca</Label>
            <span className="text-sm font-semibold text-blue-600">{(radius / 1000).toFixed(1)} km</span>
          </div>
          <Slider
            value={[radius]}
            onValueChange={(v) => setRadius(v[0])}
            min={500}
            max={25000}
            step={500}
            className="w-full"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={getCurrentLocation}
            disabled={geoLoading || isLoading}
            variant="outline"
            className="flex-1"
          >
            {geoLoading ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Localizando...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 mr-2" />
                Minha LocalizaÃ§Ã£o
              </>
            )}
          </Button>

          <Button onClick={handleSearch} disabled={isLoading || !lat || !lng} className="flex-1">
            {isLoading ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Buscando...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Buscar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
