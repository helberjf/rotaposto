'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Navigation } from 'lucide-react'

interface SearchResult {
  stations: Array<Record<string, unknown> & { id: string; name: string; address: string; lat: number; lng: number; source: string; isVerified: boolean }>
  center?: [number, number]
}

export default function RouteSearchForm({
  onSearch,
  isLoading,
}: {
  onSearch: (result: SearchResult) => void
  isLoading: boolean
}) {
  const [polyline, setPolyline] = useState('')
  const [bufferDistance, setBufferDistance] = useState(2000)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!polyline) {
      setError('Por favor, forneÃ§a uma rota')
      return
    }

    try {
      setError('')
      const response = await fetch(
        `/api/stations/route-search?polyline=${polyline}&bufferDistance=${bufferDistance}`
      )

      if (!response.ok) throw new Error('Erro ao buscar estaÃ§Ãµes')

      const stations = await response.json()
      onSearch({ stations })
    } catch (err) {
      setError('Erro ao buscar estaÃ§Ãµes. Verifique a rota e tente novamente.')
      console.error(err)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="polyline">Polyline da Rota</Label>
          <textarea
            id="polyline"
            placeholder="Cole aqui o polyline de sua rota (Google Maps Directions API)"
            value={polyline}
            onChange={(e) => setPolyline(e.target.value)}
            className="w-full p-2 border rounded-lg text-sm font-mono resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500">
            Obtenha o polyline da sua rota usando a Google Maps Directions API
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Buffer de DistÃ¢ncia</Label>
            <span className="text-sm font-semibold text-blue-600">{(bufferDistance / 1000).toFixed(1)} km</span>
          </div>
          <input
            type="range"
            min="500"
            max="10000"
            step="500"
            value={bufferDistance}
            onChange={(e) => setBufferDistance(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </div>

        <Button onClick={handleSearch} disabled={isLoading || !polyline} className="w-full">
          {isLoading ? (
            <>
              <Spinner className="w-4 h-4 mr-2" />
              Buscando...
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4 mr-2" />
              Buscar na Rota
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
