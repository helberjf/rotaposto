'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { MapPin, Plus, LogOut, Fuel } from 'lucide-react'
import StationForm from '@/components/owner/station-form'
import StationCard from '@/components/owner/station-card'
import { signOut } from 'next-auth/react'

interface Station {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  brand?: string
  phone?: string
  fuel_prices?: Array<{
    fuelType: string
    price: number
    updatedAt: string
  }>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [showNewStationForm, setShowNewStationForm] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/owner/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchStations()
    }
  }, [status])

  const fetchStations = async () => {
    try {
      const response = await fetch('/api/owner/stations')
      if (!response.ok) throw new Error('Failed to fetch stations')
      const data = await response.json()
      setStations(data)
    } catch (error) {
      console.error('Error fetching stations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStationCreated = async () => {
    setShowNewStationForm(false)
    await fetchStations()
  }

  const handleStationUpdated = async () => {
    setSelectedStation(null)
    await fetchStations()
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <Fuel className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Rotaposto</h1>
              <p className="text-xs text-gray-500">Dashboard do Proprietário</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{session.user?.name}</p>
              <p className="text-xs text-gray-500">{session.user?.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="stations" className="space-y-6">
          <TabsList>
            <TabsTrigger value="stations" className="flex gap-2">
              <MapPin className="w-4 h-4" />
              <span>Estações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stations" className="space-y-4">
            {/* New Station Button */}
            {!showNewStationForm && (
              <Button onClick={() => setShowNewStationForm(true)} size="lg">
                <Plus className="w-4 h-4 mr-2" />
                Nova Estação
              </Button>
            )}

            {/* New Station Form */}
            {showNewStationForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Adicionar Nova Estação</CardTitle>
                </CardHeader>
                <CardContent>
                  <StationForm onSuccess={handleStationCreated} />
                </CardContent>
              </Card>
            )}

            {/* Edit Station Form */}
            {selectedStation && (
              <Card>
                <CardHeader>
                  <CardTitle>Editar Estação</CardTitle>
                </CardHeader>
                <CardContent>
                  <StationForm 
                    station={selectedStation}
                    onSuccess={handleStationUpdated}
                  />
                </CardContent>
              </Card>
            )}

            {/* Stations List */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="w-6 h-6" />
              </div>
            ) : stations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma estação cadastrada</p>
                  <p className="text-sm mt-2">Clique no botão acima para adicionar sua primeira estação</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stations.map((station) => (
                  <StationCard
                    key={station.id}
                    station={station}
                    onEdit={() => setSelectedStation(station)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
