'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import StationMap from '@/components/driver/station-map'
import StationSuggestionForm from '@/components/driver/station-suggestion-form'
import StationList from '@/components/driver/station-list'
import LocationAutocompleteInput, {
  type LocationSuggestion,
} from '@/components/location-autocomplete-input'
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
import { calculateDistance, canReachStation } from '@/lib/geo'
import { cn } from '@/lib/utils'
import {
  Fuel,
  LocateFixed,
  MapPinned,
  MapPin,
  Route,
  Search,
} from 'lucide-react'

type SearchMode = 'route' | 'radius'
type BusyAction =
  | 'route-search'
  | 'route-location'
  | 'radius-search'
  | 'radius-location'
  | null
type FuelType = 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'GNV'
type MapLayerMode = 'map' | 'satellite'

interface StationFuelPrice {
  fuelType: FuelType
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
  distance?: number
  canReach?: boolean
  source: string
  isVerified: boolean
  fuel_prices: StationFuelPrice[]
}

type SuggestedStationPayload = Station

interface Coordinates {
  lat: number
  lng: number
}

interface GeocodeResult extends Coordinates {
  label: string
}

interface RouteOption {
  polyline: string
  distanceMeters: number
  durationSeconds: number
}

interface DirectionsResult extends RouteOption {
  routes?: RouteOption[]
}

interface RouteCandidate extends RouteOption {
  stations: Station[]
  representativeFuelPrice: number | null
  routeScore: number
  stationsUnavailable: boolean
}

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333]

const benefits = [
  {
    icon: Fuel,
    title: 'Preços em Tempo Real',
    description: 'Preços oficiais dos donos e reportes colaborativos da comunidade',
  },
  {
    icon: MapPin,
    title: 'Localização Precisa',
    description: 'Encontre postos próximos a você ou ao longo da sua rota',
  },
  {
    icon: Route,
    title: 'Sem Login Necessário',
    description: 'Contribua com preços e sugestões de forma anônima e colaborativa',
  },
]

export default function DriverPage() {
  const [searchMode, setSearchMode] = useState<SearchMode>('route')
  const [mapLayerMode, setMapLayerMode] = useState<MapLayerMode>('map')
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [error, setError] = useState('')
  const [searchSummary, setSearchSummary] = useState('')

  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>('GASOLINE')
  const [radiusQuery, setRadiusQuery] = useState('')
  const [radiusCoords, setRadiusCoords] = useState<Coordinates | null>(null)
  const [radiusKm, setRadiusKm] = useState(2)

  const [routeOrigin, setRouteOrigin] = useState('')
  const [routeDestination, setRouteDestination] = useState('')
  const [routeConsumption, setRouteConsumption] = useState('')
  const [routeTankLiters, setRouteTankLiters] = useState('')
  const [routeOriginCoords, setRouteOriginCoords] = useState<Coordinates | null>(
    null
  )
  const [routeDestinationCoords, setRouteDestinationCoords] =
    useState<Coordinates | null>(null)
  const [radiusNearbySuggestions, setRadiusNearbySuggestions] = useState<
    LocationSuggestion[]
  >([])
  const [routeOriginNearbySuggestions, setRouteOriginNearbySuggestions] =
    useState<LocationSuggestion[]>([])

  const [stations, setStations] = useState<Station[]>([])
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([])
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)

  const visibleStations = useMemo(
    () => sortStationsByFuelType(stations, selectedFuelType),
    [selectedFuelType, stations]
  )
  const cheapestStationId = useMemo(() => {
    const cheapestStation = visibleStations.find(
      (station) => getPreferredFuelPrice(station, selectedFuelType) !== null
    )

    return cheapestStation?.id
  }, [selectedFuelType, visibleStations])

  const sliderStyle = {
    '--range-progress': `${((radiusKm - 1) / 19) * 100}%`,
  } as CSSProperties & Record<'--range-progress', string>

  async function handleRadiusSearch() {
    if (!radiusQuery.trim() && !radiusCoords) {
      if (userLocation) {
        await runRadiusSearch(
          { lat: userLocation[0], lng: userLocation[1] },
          'Sua localização atual'
        )
        return
      }

      setError('Informe um endereço ou use sua localização atual.')
      return
    }

    setBusyAction('radius-search')
    setError('')

    try {
      if (radiusCoords) {
        await runRadiusSearch(
          radiusCoords,
          radiusQuery.trim() || 'Local selecionado'
        )
      } else {
        const place = await geocodeAddress(radiusQuery)
        setRadiusQuery(place.label)
        setRadiusCoords({ lat: place.lat, lng: place.lng })
        await runRadiusSearch(place, place.label)
      }
    } catch (searchError) {
      setError(
        getErrorMessage(searchError, 'Não foi possível localizar esse endereço.')
      )
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRouteSearch() {
    if (!routeOrigin.trim() && !routeOriginCoords) {
      setError('Informe a origem ou use sua localização atual.')
      return
    }

    if (!routeDestination.trim() && !routeDestinationCoords) {
      setError('Informe o destino da rota.')
      return
    }

    if (!routeConsumption.trim()) {
      setError('Informe o consumo do carro em km/l.')
      return
    }

    setBusyAction('route-search')
    setError('')
    setStations([])
    setRoutePath([])
    setSearchSummary('')

    try {
      const origin = routeOriginCoords ?? (await geocodeAddress(routeOrigin))
      const destination =
        routeDestinationCoords ?? (await geocodeAddress(routeDestination))
      const directions = await fetchDirections(origin, destination)
      const consumption = Number(routeConsumption)
      const tankLiters = Number(routeTankLiters)
      const routeOptions = getRouteOptions(directions)
      const routeCandidates = await Promise.all(
        routeOptions.map((route) =>
          buildRouteCandidate(route, selectedFuelType)
        )
      )
      const { bestRoute, fastestRoute } = selectBestRoute(
        routeCandidates,
        consumption
      )
      const decodedRoutePath = decodePolyline(bestRoute.polyline)

      setRoutePath(decodedRoutePath)
      setUserLocation([origin.lat, origin.lng])
      setMapCenter([origin.lat, origin.lng])
      setSearchSummary('Rota calculada. Buscando postos ao longo do percurso...')

      const response = await fetch(
        `/api/stations/route-search?polyline=${encodeURIComponent(
          bestRoute.polyline
        )}&bufferDistance=2000`
      )

      if (!response.ok) {
        const payload = await safeJson<{ error?: string }>(response)
        throw new Error(payload?.error || 'Não foi possível buscar postos na rota.')
      }

      const result = response.ok
        ? normalizeStations(await response.json())
        : bestRoute.stations
      const enhancedResult = result.map((station) => {
        const distanceKm = calculateDistance(
          origin.lat,
          origin.lng,
          station.lat,
          station.lng
        )

        return {
          ...station,
          distance: station.distance ?? distanceKm * 1000,
          canReach:
            tankLiters > 0 && consumption > 0
              ? canReachStation(distanceKm, tankLiters, consumption)
              : undefined,
        }
      })

      setStations(enhancedResult)
      setSearchSummary(
        buildRouteSearchSummary(
          bestRoute,
          fastestRoute,
          routeCandidates.length,
          enhancedResult.length
        )
      )
    } catch (searchError) {
      setError(getErrorMessage(searchError, 'Não foi possível calcular essa rota.'))
    } finally {
      setBusyAction(null)
    }
  }

  async function handleUseCurrentLocationForRadius() {
    setBusyAction('radius-location')
    setError('')

    try {
      const coords = await getCurrentPosition()
      const place = await reverseGeocode(coords).catch(() => ({
        ...coords,
        label: 'Sua localização atual',
      }))
      const nearbySuggestions = await fetchNearbySuggestions(coords).catch(
        () => []
      )
      setRadiusQuery(place.label)
      setRadiusCoords(coords)
      setRadiusNearbySuggestions(nearbySuggestions)
      await runRadiusSearch(coords, place.label)
    } catch (locationError) {
      setError(
        getErrorMessage(locationError, 'Não foi possível acessar sua localização.')
      )
    } finally {
      setBusyAction(null)
    }
  }

  async function handleUseCurrentLocationForRoute() {
    setBusyAction('route-location')
    setError('')

    try {
      const coords = await getCurrentPosition()
      const place = await reverseGeocode(coords).catch(() => ({
        ...coords,
        label: 'Minha localização atual',
      }))
      const nearbySuggestions = await fetchNearbySuggestions(coords).catch(
        () => []
      )
      setRouteOrigin(place.label)
      setRouteOriginCoords(coords)
      setRouteOriginNearbySuggestions(nearbySuggestions)
      setUserLocation([coords.lat, coords.lng])
      setMapCenter([coords.lat, coords.lng])
    } catch (locationError) {
      setError(
        getErrorMessage(locationError, 'Não foi possível acessar sua localização.')
      )
    } finally {
      setBusyAction(null)
    }
  }

  async function runRadiusSearch(coords: Coordinates, label: string) {
    const response = await fetch(
      `/api/stations/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=${
        radiusKm * 1000
      }`
    )

    if (!response.ok) {
      const payload = await safeJson<{ error?: string }>(response)
      throw new Error(payload?.error || 'Não foi possível buscar postos por raio.')
    }

    const result = normalizeStations(await response.json())
    setStations(result)
    setRoutePath([])
    setUserLocation([coords.lat, coords.lng])
    setMapCenter([coords.lat, coords.lng])
    setSearchSummary(
      `${result.length} posto${result.length === 1 ? '' : 's'} encontrados em um raio de ${radiusKm} km de ${label}.`
    )
  }

  function handleModeChange(nextMode: SearchMode) {
    setSearchMode(nextMode)
    setError('')
    setSearchSummary('')
    setStations([])
    setRoutePath([])
    setRadiusCoords(null)
    setRadiusNearbySuggestions([])
    setRouteOriginNearbySuggestions([])
    setRouteDestinationCoords(null)
    setMapCenter(userLocation ?? DEFAULT_CENTER)
  }

  function applyRadiusSuggestion(suggestion: LocationSuggestion) {
    setRadiusCoords({ lat: suggestion.lat, lng: suggestion.lng })
    setRadiusNearbySuggestions([])
    setMapCenter([suggestion.lat, suggestion.lng])
  }

  function applyRouteOriginSuggestion(suggestion: LocationSuggestion) {
    setRouteOriginCoords({ lat: suggestion.lat, lng: suggestion.lng })
    setRouteOriginNearbySuggestions([])
    setMapCenter([suggestion.lat, suggestion.lng])
  }

  function applyRouteDestinationSuggestion(suggestion: LocationSuggestion) {
    setRouteDestinationCoords({ lat: suggestion.lat, lng: suggestion.lng })
    setMapCenter([suggestion.lat, suggestion.lng])
  }

  function handleSuggestedStationCreated(station: SuggestedStationPayload) {
    setStations((previous) => {
      if (previous.some((item) => item.id === station.id)) {
        return previous
      }

      return [station, ...previous]
    })
    setMapCenter([station.lat, station.lng])
    setSearchSummary('Posto sugerido adicionado ao mapa com sucesso.')
  }

  return (
    <div className="min-h-screen bg-[#fffdfa] text-[#18181b]">
      <header className="border-b border-[#ece7df] bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-xl bg-[#f97316] text-white shadow-[0_8px_20px_rgba(249,115,22,0.28)]">
              <Fuel className="size-4" />
            </div>
            <div className="text-xl font-semibold tracking-tight">Rotaposto</div>
          </div>
          <p className="hidden text-sm text-[#78716c] md:block">
            Encontre os melhores preços de combustível
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 sm:py-8">
        <div className="space-y-8">
          <section className="space-y-5">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.1rem]">
              Como você quer buscar?
            </h1>

            <div className="grid gap-3 md:grid-cols-2">
              <ModeCard
                active={searchMode === 'route'}
                icon={Route}
                title="Rota com Postos"
                description="Informe origem e destino e veja os postos mais baratos no caminho"
                onClick={() => handleModeChange('route')}
              />
              <ModeCard
                active={searchMode === 'radius'}
                icon={MapPinned}
                title="Busca por Raio"
                description="Pesquise postos numa área ao redor de qualquer localização por raio customizado"
                onClick={() => handleModeChange('radius')}
              />
            </div>
          </section>

          <section className="rounded-[24px] border border-[#eaded3] bg-white p-4 shadow-[0_20px_45px_rgba(15,23,42,0.05)] sm:p-5">
            <StationSuggestionForm onCreated={handleSuggestedStationCreated} />

            {error ? (
              <div className="mb-4 rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]">
                {error}
              </div>
            ) : null}

            {searchMode === 'route' ? (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleRouteSearch()
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="origin" className="text-sm font-medium">
                      Origem *
                    </Label>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <LocationAutocompleteInput
                        id="origin"
                        value={routeOrigin}
                        placeholder="Ex: Avenida Paulista, São Paulo"
                        suggestionsOverride={routeOriginNearbySuggestions}
                        onValueChange={(value) => {
                          setRouteOrigin(value)
                          setRouteOriginCoords(null)
                          setRouteOriginNearbySuggestions([])
                        }}
                        onLocationSelect={applyRouteOriginSuggestion}
                        inputClassName="h-11 rounded-xl border-[#e7d6c7] bg-[#fffdfa]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleUseCurrentLocationForRoute()}
                        disabled={busyAction !== null}
                        className="h-11 rounded-xl border-[#e7d6c7] bg-white px-4"
                      >
                        {busyAction === 'route-location' ? (
                          <>
                            <Spinner className="mr-2 size-4" />
                            Localizando...
                          </>
                        ) : (
                          <>
                            <LocateFixed className="mr-2 size-4" />
                            Minha Localização
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-[#78716c]">
                      Digite o endereço de partida
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="destination" className="text-sm font-medium">
                      Destino *
                    </Label>
                    <LocationAutocompleteInput
                      id="destination"
                      value={routeDestination}
                      placeholder="Ex: Rodovia Imigrantes, Santos"
                      onValueChange={(value) => {
                        setRouteDestination(value)
                        setRouteDestinationCoords(null)
                      }}
                      onLocationSelect={applyRouteDestinationSuggestion}
                      inputClassName="h-11 rounded-xl border-[#e7d6c7] bg-[#fffdfa]"
                    />
                    <p className="text-xs text-[#78716c]">
                      Digite o endereço de chegada
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tipo de Combustível *</Label>
                    <Select
                      value={selectedFuelType}
                      onValueChange={(value) => setSelectedFuelType(value as FuelType)}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl border-[#e7d6c7] bg-[#fffdfa]">
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
                    <Label htmlFor="consumption" className="text-sm font-medium">
                      Consumo do Carro (km/l) *
                    </Label>
                    <Input
                      id="consumption"
                      type="number"
                      min="1"
                      step="0.1"
                      placeholder="Ex: 12.5"
                      value={routeConsumption}
                      onChange={(event) => setRouteConsumption(event.target.value)}
                      className="h-11 rounded-xl border-[#e7d6c7] bg-[#fffdfa]"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="tank" className="text-sm font-medium">
                      Combustível no Tanque (litros) - Opcional
                    </Label>
                    <Input
                      id="tank"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Ex: 30 (deixe em branco para não calcular autonomia)"
                      value={routeTankLiters}
                      onChange={(event) => setRouteTankLiters(event.target.value)}
                      className="h-11 rounded-xl border-[#e7d6c7] bg-[#fffdfa]"
                    />
                    <p className="text-xs text-[#78716c]">
                      Se informado, vamos destacar os postos mais viáveis para a sua autonomia atual.
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={busyAction !== null}
                  className="h-11 rounded-xl bg-[#f97316] px-5 text-white shadow-[0_10px_24px_rgba(249,115,22,0.3)] hover:bg-[#ea6a12]"
                >
                  {busyAction === 'route-search' ? (
                    <>
                      <Spinner className="mr-2 size-4" />
                      Calculando rota...
                    </>
                  ) : (
                    <>
                      <Route className="mr-2 size-4" />
                      Calcular Rota
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleRadiusSearch()
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="radius-query" className="text-sm font-medium">
                    Endereço ou Local
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <LocationAutocompleteInput
                      id="radius-query"
                      value={radiusQuery}
                      placeholder="Ex: Avenida Paulista, São Paulo"
                      className="flex-1"
                      suggestionsOverride={radiusNearbySuggestions}
                      onValueChange={(value) => {
                        setRadiusQuery(value)
                        setRadiusCoords(null)
                        setRadiusNearbySuggestions([])
                      }}
                      onLocationSelect={applyRadiusSuggestion}
                      inputClassName="h-11 rounded-xl border-[#e7d6c7] bg-[#fffdfa]"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={busyAction !== null}
                      className="h-11 rounded-xl border-[#e7d6c7] bg-white px-5"
                    >
                      {busyAction === 'radius-search' ? (
                        <>
                          <Spinner className="mr-2 size-4" />
                          Buscando...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 size-4" />
                          Buscar
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-[#78716c]">
                    Ou use sua localização atual
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleUseCurrentLocationForRadius()}
                  disabled={busyAction !== null}
                  className="h-11 w-full rounded-xl border-[#e7d6c7] bg-white"
                >
                  {busyAction === 'radius-location' ? (
                    <>
                      <Spinner className="mr-2 size-4" />
                      Localizando...
                    </>
                  ) : (
                    <>
                      <LocateFixed className="mr-2 size-4" />
                      Usar Minha Localização
                    </>
                  )}
                </Button>

                <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tipo de Combustível</Label>
                    <Select
                      value={selectedFuelType}
                      onValueChange={(value) => setSelectedFuelType(value as FuelType)}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl border-[#e7d6c7] bg-[#fffdfa]">
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

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="radius-slider" className="text-sm font-medium">
                        Raio de Busca
                      </Label>
                      <span className="text-sm font-semibold text-[#f97316]">
                        {radiusKm} km
                      </span>
                    </div>
                    <input
                      id="radius-slider"
                      type="range"
                      min="1"
                      max="20"
                      step="1"
                      value={radiusKm}
                      onChange={(event) => setRadiusKm(Number(event.target.value))}
                      className="fuelroute-range"
                      style={sliderStyle}
                    />
                    <p className="text-xs text-[#78716c]">
                      Ajuste o raio para encontrar postos mais perto ou mais longe
                    </p>
                  </div>
                </div>
              </form>
            )}

            <div className="mt-5 overflow-hidden rounded-[22px] border border-[#eaded3] bg-[#fcfbf8]">
              <div className="relative h-[280px] sm:h-[360px]">
                <div className="absolute left-4 top-4 z-[500] inline-flex rounded-xl border border-[#e5e7eb] bg-white p-1 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
                  <button
                    type="button"
                    onClick={() => setMapLayerMode('map')}
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                      mapLayerMode === 'map'
                        ? 'bg-white text-[#18181b]'
                        : 'text-[#78716c]'
                    )}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapLayerMode('satellite')}
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                      mapLayerMode === 'satellite'
                        ? 'bg-white text-[#18181b]'
                        : 'text-[#78716c]'
                    )}
                  >
                    Satellite
                  </button>
                </div>

                <StationMap
                  stations={visibleStations}
                  center={mapCenter}
                  routePath={routePath}
                  userLocation={userLocation}
                  tileMode={mapLayerMode}
                  preferredFuelType={selectedFuelType}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {benefits.map((benefit) => (
              <BenefitCard
                key={benefit.title}
                icon={benefit.icon}
                title={benefit.title}
                description={benefit.description}
              />
            ))}
          </section>

          {visibleStations.length > 0 ? (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Postos encontrados
                </h2>
                <p className="text-sm text-[#78716c]">
                  {searchSummary || 'Veja os postos e preços disponíveis para essa busca.'}
                </p>
              </div>
              <StationList
                stations={visibleStations}
                preferredFuelType={selectedFuelType}
                highlightStationId={cheapestStationId}
              />
            </section>
          ) : searchSummary ? (
            <section className="rounded-[22px] border border-dashed border-[#eaded3] bg-white px-6 py-8 text-center text-sm text-[#78716c]">
              {searchSummary}
            </section>
          ) : null}
        </div>
      </main>
    </div>
  )
}

function ModeCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean
  icon: typeof Route
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-[22px] border p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.03)] transition-all sm:p-5',
        active
          ? 'border-[#f97316] bg-[#fff4eb] shadow-[0_12px_28px_rgba(249,115,22,0.14)]'
          : 'border-[#e7e5e4] bg-white hover:border-[#f5c8a6]'
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-xl',
            active ? 'bg-[#f97316] text-white' : 'bg-[#f5f5f4] text-[#44403c]'
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="space-y-1">
          <div className="text-lg font-semibold tracking-tight">{title}</div>
          <p className="text-sm leading-6 text-[#78716c]">{description}</p>
        </div>
      </div>
    </button>
  )
}

function BenefitCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Fuel
  title: string
  description: string
}) {
  return (
    <div className="rounded-[22px] border border-[#e7e5e4] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-[#fff4eb] text-[#f97316]">
        <Icon className="size-5" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#78716c]">{description}</p>
    </div>
  )
}

async function geocodeAddress(query: string): Promise<GeocodeResult> {
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)

  if (!response.ok) {
    const payload = await safeJson<{ error?: string }>(response)
    throw new Error(payload?.error || 'Endereço não encontrado.')
  }

  return response.json() as Promise<GeocodeResult>
}

async function reverseGeocode(coords: Coordinates): Promise<GeocodeResult> {
  const response = await fetch(
    `/api/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`
  )

  if (!response.ok) {
    const payload = await safeJson<{ error?: string }>(response)
    throw new Error(payload?.error || 'Não foi possível identificar sua localização.')
  }

  return response.json() as Promise<GeocodeResult>
}

async function fetchNearbySuggestions(
  coords: Coordinates
): Promise<LocationSuggestion[]> {
  const response = await fetch(
    `/api/geocode/nearby-suggest?lat=${coords.lat}&lng=${coords.lng}`
  )

  if (!response.ok) {
    return []
  }

  return response.json() as Promise<LocationSuggestion[]>
}

async function fetchDirections(
  origin: Coordinates,
  destination: Coordinates
): Promise<DirectionsResult> {
  const response = await fetch(
    `/api/directions?originLat=${origin.lat}&originLng=${origin.lng}&destinationLat=${destination.lat}&destinationLng=${destination.lng}`
  )

  if (!response.ok) {
    const payload = await safeJson<{ error?: string }>(response)
    throw new Error(payload?.error || 'Não foi possível gerar a rota.')
  }

  return response.json() as Promise<DirectionsResult>
}

function getRouteOptions(directions: DirectionsResult): RouteOption[] {
  const candidates =
    directions.routes && directions.routes.length > 0
      ? directions.routes
      : [
          {
            polyline: directions.polyline,
            distanceMeters: directions.distanceMeters,
            durationSeconds: directions.durationSeconds,
          },
        ]

  const uniqueRoutes = new Map<string, RouteOption>()

  candidates.forEach((route) => {
    if (!route.polyline || uniqueRoutes.has(route.polyline)) {
      return
    }

    uniqueRoutes.set(route.polyline, route)
  })

  return Array.from(uniqueRoutes.values())
}

async function buildRouteCandidate(
  route: RouteOption,
  preferredFuelType: FuelType
): Promise<RouteCandidate> {
  try {
    const response = await fetch(
      `/api/stations/route-search?polyline=${encodeURIComponent(
        route.polyline
      )}&bufferDistance=2000`
    )

    if (!response.ok) {
      return {
        ...route,
        stations: [],
        representativeFuelPrice: null,
        routeScore: getRouteFallbackScore(route),
        stationsUnavailable: true,
      }
    }

    const stations = normalizeStations(await response.json())

    return {
      ...route,
      stations,
      representativeFuelPrice: getRepresentativeFuelPrice(
        stations,
        preferredFuelType
      ),
      routeScore: getRouteFallbackScore(route),
      stationsUnavailable: false,
    }
  } catch {
    return {
      ...route,
      stations: [],
      representativeFuelPrice: null,
      routeScore: getRouteFallbackScore(route),
      stationsUnavailable: true,
    }
  }
}

function selectBestRoute(
  candidates: RouteCandidate[],
  consumptionKmPerLiter: number
) {
  const fastestRoute = [...candidates].sort(
    (routeA, routeB) =>
      routeA.durationSeconds - routeB.durationSeconds ||
      routeA.distanceMeters - routeB.distanceMeters
  )[0]

  if (!fastestRoute) {
    throw new Error('Nenhuma rota disponÃ­vel.')
  }

  const availableFuelPrices = candidates
    .map((candidate) => candidate.representativeFuelPrice)
    .filter((price): price is number => price !== null)
  const fallbackFuelPrice = availableFuelPrices.length
    ? average(availableFuelPrices)
    : null

  const scoredCandidates = candidates.map((candidate) => ({
    ...candidate,
    routeScore: calculateRouteScore(
      candidate,
      fastestRoute,
      fallbackFuelPrice,
      consumptionKmPerLiter
    ),
  }))

  const bestRoute = [...scoredCandidates].sort(
    (routeA, routeB) =>
      routeA.routeScore - routeB.routeScore ||
      routeA.durationSeconds - routeB.durationSeconds ||
      routeA.distanceMeters - routeB.distanceMeters
  )[0]

  return { bestRoute, fastestRoute }
}

function calculateRouteScore(
  candidate: RouteCandidate,
  fastestRoute: RouteCandidate,
  fallbackFuelPrice: number | null,
  consumptionKmPerLiter: number
) {
  const effectiveFuelPrice =
    candidate.representativeFuelPrice ?? fallbackFuelPrice

  if (
    !effectiveFuelPrice ||
    !Number.isFinite(consumptionKmPerLiter) ||
    consumptionKmPerLiter <= 0
  ) {
    return getRouteFallbackScore(candidate)
  }

  const distanceKm = candidate.distanceMeters / 1000
  const estimatedFuelCost = (distanceKm / consumptionKmPerLiter) * effectiveFuelPrice
  const extraMinutes = Math.max(
    0,
    candidate.durationSeconds - fastestRoute.durationSeconds
  ) / 60

  return estimatedFuelCost + extraMinutes * 0.2
}

function getRouteFallbackScore(route: RouteOption) {
  return route.durationSeconds + route.distanceMeters / 1000
}

function getRepresentativeFuelPrice(
  stations: Station[],
  preferredFuelType: FuelType
) {
  const prices = stations
    .map((station) => getPreferredFuelPrice(station, preferredFuelType))
    .filter((price): price is number => price !== null)
    .sort((priceA, priceB) => priceA - priceB)

  if (prices.length === 0) {
    return null
  }

  if (prices.length === 1) {
    return prices[0]
  }

  if (prices.length === 2) {
    return prices[0] * 0.65 + prices[1] * 0.35
  }

  return prices[0] * 0.6 + prices[1] * 0.3 + prices[2] * 0.1
}

function buildRouteSearchSummary(
  bestRoute: RouteCandidate,
  fastestRoute: RouteCandidate,
  totalAlternatives: number,
  stationCount: number
) {
  const stationsLabel = `${stationCount} posto${stationCount === 1 ? '' : 's'} encontrado${stationCount === 1 ? '' : 's'} ao longo da rota.`

  if (totalAlternatives <= 1) {
    return stationsLabel
  }

  if (bestRoute.polyline === fastestRoute.polyline) {
    return `Rota mais rÃ¡pida mantida apÃ³s comparar ${totalAlternatives} opÃ§Ãµes. ${stationsLabel}`
  }

  if (bestRoute.stationsUnavailable && stationCount === 0) {
    return `Rota alternativa escolhida pela malha viÃ¡ria. NÃ£o foi possÃ­vel comparar os postos agora.`
  }

  return `Rota mais econÃ´mica selecionada apÃ³s comparar ${totalAlternatives} opÃ§Ãµes. ${stationsLabel}`
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length
}

function normalizeStations(payload: unknown): Station[] {
  if (!Array.isArray(payload)) {
    return []
  }

  return payload
    .map((item) => {
      const station = item as Record<string, unknown>
      const rawPrices = Array.isArray(station.fuel_prices)
        ? station.fuel_prices
        : []

      return {
        id: String(station.id || ''),
        name: String(station.name || 'Posto'),
        address: String(station.address || ''),
        lat: Number(station.lat),
        lng: Number(station.lng),
        brand: typeof station.brand === 'string' ? station.brand : undefined,
        phone: typeof station.phone === 'string' ? station.phone : undefined,
        distance:
          station.distance === undefined || station.distance === null
            ? undefined
            : Number(station.distance),
        source: String(station.source || 'OWNER'),
        isVerified: Boolean(station.isVerified),
        fuel_prices: rawPrices
          .map((price) => {
            const fuel = price as Record<string, unknown>

            return {
              fuelType: String(fuel.fuelType) as FuelType,
              price: Number(fuel.price),
              updatedAt: String(fuel.updatedAt || new Date().toISOString()),
            }
          })
          .filter((price) => Number.isFinite(price.price)),
      }
    })
    .filter(
      (station) =>
        station.id &&
        Number.isFinite(station.lat) &&
        Number.isFinite(station.lng)
    )
}

function sortStationsByFuelType(
  stations: Station[],
  preferredFuelType: FuelType
): Station[] {
  return [...stations].sort((stationA, stationB) => {
    const stationAPrice = getPreferredFuelPrice(stationA, preferredFuelType)
    const stationBPrice = getPreferredFuelPrice(stationB, preferredFuelType)

    if (stationAPrice === null && stationBPrice === null) {
      return 0
    }

    if (stationAPrice === null) {
      return 1
    }

    if (stationBPrice === null) {
      return -1
    }

    return stationAPrice - stationBPrice
  })
}

function getPreferredFuelPrice(
  station: Station,
  preferredFuelType: FuelType
): number | null {
  const price = station.fuel_prices.find(
    (fuel) => fuel.fuelType === preferredFuelType
  )

  return price ? price.price : null
}

function decodePolyline(
  encoded: string,
  precision: number = 5
): Array<[number, number]> {
  const coordinates: Array<[number, number]> = []
  const factor = 10 ** precision
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    lat += result & 1 ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    lng += result & 1 ? ~(result >> 1) : result >> 1

    coordinates.push([lat / factor, lng / factor])
  }

  return coordinates
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

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
