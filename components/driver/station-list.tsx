'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import PriceReportDialog from './price-report-dialog'
import { MapPin, PencilLine, Phone, RefreshCw, Share2 } from 'lucide-react'

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
  distance?: number
  canReach?: boolean
  fuel_prices?: FuelPrice[]
  owner_prices?: FuelPrice[]
  community_prices?: CommunityFuelPrice[]
  source: string
  isVerified: boolean
}

interface PriceReportResult {
  fuelType: FuelType
  communityPrice?: CommunityFuelPrice | null
}

export default function StationList({
  stations,
  preferredFuelType,
  highlightStationId,
  onPriceSubmitted,
  onRefresh,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  stations: Station[]
  preferredFuelType?: FuelType
  highlightStationId?: string
  onPriceSubmitted?: (stationId: string, result: PriceReportResult) => void
  onRefresh?: (stationId: string) => Promise<void>
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}) {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [sharedStationId, setSharedStationId] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Trigger server load-more when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || !onLoadMore) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore()
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])

  if (!stations.length) {
    return (
      <div className="rounded-[22px] border border-dashed border-[#eaded3] bg-white px-6 py-10 text-center text-sm text-[#78716c]">
        Nenhum posto encontrado para essa busca.
      </div>
    )
  }

  async function handleShare(station: Station) {
    const message = `${station.name}\n${station.address}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: station.name,
          text: message,
        })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message)
        setSharedStationId(station.id)
        window.setTimeout(() => setSharedStationId(null), 1800)
      }
    } catch {
      setSharedStationId(null)
    }
  }

  function handlePriceSubmitted(result: PriceReportResult) {
    if (!selectedStation) {
      setSelectedStation(null)
      return
    }

    onPriceSubmitted?.(selectedStation.id, result)
    setSelectedStation(null)
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {stations.map((station) => {
          const ownerPrices = reorderFuelPrices(
            station.owner_prices || station.fuel_prices || [],
            preferredFuelType
          )
          const communityPrices = reorderFuelPrices(
            station.community_prices || [],
            preferredFuelType
          )
          const featuredOwnerPrice = preferredFuelType
            ? ownerPrices.find((fuel) => fuel.fuelType === preferredFuelType)
            : ownerPrices[0]
          const featuredCommunityPrice = preferredFuelType
            ? communityPrices.find((fuel) => fuel.fuelType === preferredFuelType)
            : communityPrices[0]
          const displayPrice = featuredCommunityPrice || featuredOwnerPrice
          const displaySourceLabel = featuredCommunityPrice
            ? 'Comunidade'
            : featuredOwnerPrice
              ? 'Dono'
              : null
          const fuelRows = buildFuelComparisonRows(
            ownerPrices,
            communityPrices,
            preferredFuelType
          )
          const isCheapest = highlightStationId === station.id

          return (
            <article
              key={station.id}
              className={
                isCheapest
                  ? 'rounded-[22px] border border-[#f97316] bg-[#fffaf5] p-5 shadow-[0_18px_36px_rgba(249,115,22,0.14)]'
                  : 'rounded-[22px] border border-[#eaded3] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.04)]'
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-tight text-[#18181b]">
                      {station.name}
                    </h3>
                    {isCheapest ? (
                      <span className="rounded-full bg-[#f97316] px-2.5 py-1 text-xs font-semibold text-white">
                        Menor preço
                      </span>
                    ) : null}
                    {station.isVerified ? (
                      <span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-xs font-semibold text-[#15803d]">
                        Verificado
                      </span>
                    ) : null}
                    {station.canReach === true ? (
                      <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-semibold text-[#1d4ed8]">
                        Autonomia OK
                      </span>
                    ) : null}
                    {station.canReach === false ? (
                      <span className="rounded-full bg-[#fff7ed] px-2.5 py-1 text-xs font-semibold text-[#c2410c]">
                        Reabasteça antes
                      </span>
                    ) : null}
                  </div>
                  {station.brand ? (
                    <p className="text-sm text-[#78716c]">{station.brand}</p>
                  ) : null}
                </div>

                {displayPrice ? (
                  <div className="rounded-2xl bg-[#fff4eb] px-4 py-3 text-right">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#78716c]">
                      {formatFuelType(displayPrice.fuelType)}
                    </p>
                    <p className="text-lg font-semibold text-[#ea580c]">
                      R$ {displayPrice.price.toFixed(2)}
                    </p>
                    {displaySourceLabel ? (
                      <p className="mt-1 text-xs text-[#78716c]">{displaySourceLabel}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3 text-sm text-[#57534e]">
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-[#f97316]" />
                  <div>
                    <p>{station.address}</p>
                    {typeof station.distance === 'number' ? (
                      <p className="mt-1 text-xs text-[#78716c]">
                        {(station.distance / 1000).toFixed(1)} km de distância
                      </p>
                    ) : null}
                  </div>
                </div>

                {station.phone ? (
                  <div className="flex gap-3">
                    <Phone className="mt-0.5 size-4 shrink-0 text-[#f97316]" />
                    <a href={`tel:${station.phone}`} className="hover:text-[#ea580c]">
                      {station.phone}
                    </a>
                  </div>
                ) : null}
              </div>

              {fuelRows.length > 0 ? (
                <div className="mt-5 rounded-[18px] bg-[#fcfbf8] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#18181b]">
                      Comparativo de preços
                    </p>
                    <p className="text-xs text-[#78716c]">
                      Dono x Comunidade
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {fuelRows.map((fuel) => (
                      <div
                        key={fuel.fuelType}
                        className="rounded-2xl border border-[#ece7df] bg-white px-3 py-3"
                      >
                        <p className="text-sm font-medium text-[#57534e]">
                          {formatFuelType(fuel.fuelType)}
                        </p>

                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-3 rounded-xl bg-[#fffaf5] px-3 py-2">
                            <span className="font-medium text-[#78716c]">Dono</span>
                            <span className="font-semibold text-[#18181b]">
                              {fuel.ownerPrice
                                ? `R$ ${fuel.ownerPrice.price.toFixed(2)}`
                                : 'Sem valor'}
                            </span>
                          </div>

                          <div className="rounded-xl bg-[#f8fbff] px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-[#64748b]">
                                Comunidade
                              </span>
                              <span className="font-semibold text-[#0f172a]">
                                {fuel.communityPrice
                                  ? `R$ ${fuel.communityPrice.price.toFixed(2)}`
                                  : 'Sem reportes'}
                              </span>
                            </div>
                            {fuel.communityPrice?.reportCount ? (
                              <p className="mt-1 text-xs text-[#64748b]">
                                {fuel.communityPrice.reportCount} reporte
                                {fuel.communityPrice.reportCount === 1 ? '' : 's'}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  onClick={() => setSelectedStation(station)}
                  className="h-10 flex-1 rounded-xl bg-[#f97316] text-white hover:bg-[#ea6a12]"
                >
                  <PencilLine className="mr-2 size-4" />
                  Editar preço
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleShare(station)}
                  className="h-10 flex-1 rounded-xl border-[#eaded3]"
                >
                  <Share2 className="mr-2 size-4" />
                  {sharedStationId === station.id ? 'Copiado' : 'Compartilhar'}
                </Button>
                {onRefresh ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={refreshingId === station.id}
                    onClick={async () => {
                      setRefreshingId(station.id)
                      await onRefresh(station.id)
                      setRefreshingId(null)
                    }}
                    className="h-10 rounded-xl border-[#eaded3] px-3"
                    title="Atualizar posto"
                  >
                    <RefreshCw
                      className={`size-4 ${refreshingId === station.id ? 'animate-spin' : ''}`}
                    />
                  </Button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      {/* Sentinel — triggers server-side load-more when scrolled into view */}
      <div ref={sentinelRef} className="h-1" />

      {loadingMore ? (
        <p className="py-2 text-center text-sm text-[#78716c]">Carregando mais postos…</p>
      ) : hasMore ? (
        <p className="py-2 text-center text-sm text-[#78716c]">Role para carregar mais postos</p>
      ) : stations.length > 0 ? (
        <p className="py-2 text-center text-sm text-[#78716c]">
          Todos os {stations.length} postos exibidos
        </p>
      ) : null}

      {selectedStation ? (
        <PriceReportDialog
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
          onSubmit={handlePriceSubmitted}
        />
      ) : null}
    </>
  )
}

function reorderFuelPrices(
  prices: Array<FuelPrice | CommunityFuelPrice>,
  preferredFuelType?: FuelType
): Array<FuelPrice | CommunityFuelPrice> {
  if (!preferredFuelType) {
    return prices
  }

  return [...prices].sort((priceA, priceB) => {
    if (priceA.fuelType === preferredFuelType) return -1
    if (priceB.fuelType === preferredFuelType) return 1
    return 0
  })
}

function buildFuelComparisonRows(
  ownerPrices: FuelPrice[],
  communityPrices: CommunityFuelPrice[],
  preferredFuelType?: FuelType
) {
  const orderedFuelTypes = sortFuelTypes(
    Array.from(
      new Set([
        ...ownerPrices.map((price) => price.fuelType),
        ...communityPrices.map((price) => price.fuelType),
      ])
    ),
    preferredFuelType
  )

  return orderedFuelTypes.map((fuelType) => ({
    fuelType,
    ownerPrice: ownerPrices.find((price) => price.fuelType === fuelType) || null,
    communityPrice:
      communityPrices.find((price) => price.fuelType === fuelType) || null,
  }))
}

function sortFuelTypes(fuelTypes: FuelType[], preferredFuelType?: FuelType) {
  return [...fuelTypes].sort((fuelTypeA, fuelTypeB) => {
    if (!preferredFuelType) {
      return 0
    }

    if (fuelTypeA === preferredFuelType) return -1
    if (fuelTypeB === preferredFuelType) return 1
    return 0
  })
}

function formatFuelType(fuelType: FuelType): string {
  if (fuelType === 'GASOLINE') return 'Gasolina'
  if (fuelType === 'ETHANOL') return 'Etanol'
  if (fuelType === 'DIESEL') return 'Diesel'
  return 'GNV'
}
