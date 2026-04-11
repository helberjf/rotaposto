'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PriceReportDialog from './price-report-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Building2, MapPin, Search, X } from 'lucide-react'
import rawCities from '@/lib/brazil-cities.json'

const ALL_CITIES = rawCities as { c: string; u: string }[]

interface CityOption {
  label: string
  city: string
}

type FuelType = 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'GNV'

interface FuelPrice {
  fuelType: FuelType
  price: number
  updatedAt: string
}

interface CommunityFuelPrice extends FuelPrice {
  reportCount?: number
}

interface Station {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  brand?: string
  phone?: string
  source: string
  isVerified: boolean
  fuel_prices?: FuelPrice[]
  owner_prices?: FuelPrice[]
  community_prices?: CommunityFuelPrice[]
}

interface PriceReportResult {
  fuelType: FuelType
  communityPrice?: CommunityFuelPrice | null
}

export default function StationPriceSearch({
  onPriceSubmitted,
}: {
  onPriceSubmitted?: (stationId: string, result: PriceReportResult) => void
}) {
  // ── city filter (local list — no network requests) ──────────────
  const [cityQuery, setCityQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null)
  const [cityOpen, setCityOpen] = useState(false)
  const [showCityRequired, setShowCityRequired] = useState(false)
  const cityWrapperRef = useRef<HTMLDivElement>(null)

  const citySuggestions = useMemo<CityOption[]>(() => {
    const q = cityQuery.trim().toLowerCase()
    if (q.length < 2 || selectedCity) return []
    return ALL_CITIES
      .filter((m) =>
        m.c.toLowerCase().includes(q) ||
        m.u.toLowerCase() === q
      )
      .slice(0, 10)
      .map((m) => ({ label: `${m.c} - ${m.u}`, city: m.c }))
  }, [cityQuery, selectedCity])

  useEffect(() => {
    setCityOpen(citySuggestions.length > 0)
  }, [citySuggestions])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!cityWrapperRef.current?.contains(e.target as Node)) {
        setCityOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function clearCity() {
    setSelectedCity(null)
    setCityQuery('')
    setResults([])
    setSearched(false)
    setShowCityRequired(false)
  }

  // ── station search ───────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Station[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleSearch = useCallback(async () => {
    if (!selectedCity) {
      setShowCityRequired(true)
      return
    }
    const trimmed = query.trim()
    if (trimmed.length < 2) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setSearched(true)

    try {
      const params = new URLSearchParams({ q: trimmed })
      if (selectedCity) params.set('city', selectedCity.city)

      const response = await fetch(
        `/api/stations/search?${params.toString()}`,
        { signal: controller.signal }
      )
      if (!response.ok) throw new Error()
      const stations = (await response.json()) as Station[]
      setResults(stations)
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setResults([])
      }
    } finally {
      setLoading(false)
    }
  }, [query, selectedCity])

  function handlePriceSubmitted(result: PriceReportResult) {
    if (!selectedStation) return

    onPriceSubmitted?.(selectedStation.id, result)

    setResults((prev) =>
      prev.map((s) => {
        if (s.id !== selectedStation.id) return s
        const communityPrice = result.communityPrice
        if (!communityPrice) return s
        const updatedCommunity = [...(s.community_prices || [])]
        const idx = updatedCommunity.findIndex(
          (p) => p.fuelType === communityPrice.fuelType
        )
        if (idx >= 0) {
          updatedCommunity[idx] = communityPrice
        } else {
          updatedCommunity.push(communityPrice)
        }
        return { ...s, community_prices: updatedCommunity }
      })
    )

    setSelectedStation(null)
  }

  return (
    <div className="space-y-4">
      {/* ── City filter ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Cidade <span className="text-red-500">*</span>
        </Label>
        <div ref={cityWrapperRef} className="relative">
          {selectedCity ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5 text-sm text-[#15803d]">
              <Building2 className="size-4 shrink-0" />
              <span className="flex-1">{selectedCity.label}</span>
              <button
                type="button"
                onClick={clearCity}
                aria-label="Remover filtro de cidade"
                className="text-[#15803d] hover:text-[#166534]"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <Input
                value={cityQuery}
                onChange={(e) => {
                  setCityQuery(e.target.value)
                  setShowCityRequired(false)
                }}
                onFocus={() => {
                  if (citySuggestions.length > 0) setCityOpen(true)
                }}
                placeholder="Ex: Juiz de Fora"
                className={`h-11 rounded-xl border-[#e7d6c7] bg-[#fffdfa]${
                  showCityRequired ? ' border-red-400 focus-visible:ring-red-300' : ''
                }`}
              />
              {cityOpen && citySuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-[#eaded3] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.10)]">
                  {citySuggestions.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setSelectedCity(opt)
                        setCityQuery(opt.label)
                        setCityOpen(false)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-[#fff4eb]"
                    >
                      <Building2 className="size-4 shrink-0 text-[#f97316]" />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
        {showCityRequired ? (
          <p className="text-xs text-red-500">Selecione uma cidade antes de buscar.</p>
        ) : null}
      </div>

      {/* ── Station name/address search ───────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSearch()
        }}
        className="space-y-2"
      >
        <Label htmlFor="price-search-query" className="text-sm font-medium">
          Nome ou endereço do posto
        </Label>
        <div className="flex gap-2">
          <Input
            id="price-search-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Posto Ipiranga ou Av. Paulista"
            className="h-11 flex-1 rounded-xl border-[#e7d6c7] bg-[#fffdfa]"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={loading || query.trim().length < 2 || !selectedCity}
            className="h-11 rounded-xl border-[#e7d6c7] bg-white px-5"
          >
            {loading ? (
              <Spinner className="size-4" />
            ) : (
              <>
                <Search className="mr-2 size-4" />
                Buscar
              </>
            )}
          </Button>
        </div>
      </form>

      {searched && !loading && results.length === 0 ? (
        <p className="text-center text-sm text-[#78716c]">
          Nenhum posto encontrado para &ldquo;{query}&rdquo;
          {selectedCity ? ` em ${selectedCity.label}` : ''}.
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {results.map((station) => (
            <button
              key={station.id}
              type="button"
              onClick={() => setSelectedStation(station)}
              className="flex w-full items-start gap-3 rounded-xl border border-[#eaded3] bg-white p-3 text-left transition-colors hover:bg-[#fff4eb]"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#fff4eb] text-[#f97316]">
                <MapPin className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#18181b] truncate">
                  {station.name}
                </p>
                <p className="text-xs text-[#78716c] truncate">{station.address}</p>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {selectedStation ? (
        <PriceReportDialog
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
          onSubmit={handlePriceSubmitted}
        />
      ) : null}
    </div>
  )
}
