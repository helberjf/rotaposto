'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Navigation, Fuel } from 'lucide-react'
import StationList from '@/components/driver/station-list'
import StationMap from '@/components/driver/station-map'
import RadiusSearchForm from '@/components/driver/radius-search-form'
import RouteSearchForm from '@/components/driver/route-search-form'

export default function DriverPage() {
  const [searchType, setSearchType] = useState<'radius' | 'route'>('radius')
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(false)
  const [mapCenter, setMapCenter] = useState<[number, number]>([-23.5505, -46.6333]) // São Paulo

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <Fuel className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">FuelRoute</h1>
              <p className="text-sm text-gray-500">Encontre o melhor combustível perto de você</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-96 flex flex-col bg-white border-r border-gray-200 overflow-y-auto">
          <Tabs value={searchType} onValueChange={(v) => setSearchType(v as 'radius' | 'route')} className="flex-1 flex flex-col">
            <TabsList className="rounded-none border-b">
              <TabsTrigger value="radius" className="flex gap-2">
                <MapPin className="w-4 h-4" />
                <span>Raio</span>
              </TabsTrigger>
              <TabsTrigger value="route" className="flex gap-2">
                <Navigation className="w-4 h-4" />
                <span>Rota</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="radius" className="flex-1 overflow-y-auto">
              <div className="p-4">
                <RadiusSearchForm 
                  onSearch={(data) => {
                    setLoading(true)
                    setStations(data.stations || [])
                    if (data.center) setMapCenter(data.center)
                    setLoading(false)
                  }}
                  isLoading={loading}
                />
                {stations.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      {stations.length} Estação{stations.length !== 1 ? 's' : ''} Encontrada{stations.length !== 1 ? 's' : ''}
                    </h3>
                    <StationList stations={stations} />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="route" className="flex-1 overflow-y-auto">
              <div className="p-4">
                <RouteSearchForm 
                  onSearch={(data) => {
                    setLoading(true)
                    setStations(data.stations || [])
                    setLoading(false)
                  }}
                  isLoading={loading}
                />
                {stations.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      {stations.length} Estação{stations.length !== 1 ? 's' : ''} na Rota
                    </h3>
                    <StationList stations={stations} />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Map */}
        <main className="flex-1 hidden md:flex">
          <StationMap stations={stations} center={mapCenter} />
        </main>
      </div>
    </div>
  )
}
