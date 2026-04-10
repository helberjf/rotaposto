'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import PriceReportDialog from './price-report-dialog'
import { MapPin, Phone, Share2, ThumbsUp } from 'lucide-react'

type FuelType = 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'GNV'

interface FuelPrice {
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
  fuel_prices?: FuelPrice[]
  source: string
  isVerified: boolean
}

export default function StationList({
  stations,
  preferredFuelType,
  highlightStationId,
}: {
  stations: Station[]
  preferredFuelType?: FuelType
  highlightStationId?: string
}) {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [sharedStationId, setSharedStationId] = useState<string | null>(null)

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

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {stations.map((station) => {
          const prices = reorderFuelPrices(station.fuel_prices || [], preferredFuelType)
          const featuredPrice = preferredFuelType
            ? prices.find((fuel) => fuel.fuelType === preferredFuelType)
            : prices[0]
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

                {featuredPrice ? (
                  <div className="rounded-2xl bg-[#fff4eb] px-4 py-3 text-right">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#78716c]">
                      {formatFuelType(featuredPrice.fuelType)}
                    </p>
                    <p className="text-lg font-semibold text-[#ea580c]">
                      R$ {featuredPrice.price.toFixed(2)}
                    </p>
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

              {prices.length > 0 ? (
                <div className="mt-5 rounded-[18px] bg-[#fcfbf8] p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {prices.map((fuel) => (
                      <div
                        key={fuel.fuelType}
                        className="rounded-2xl border border-[#ece7df] bg-white px-3 py-3"
                      >
                        <p className="text-sm font-medium text-[#57534e]">
                          {formatFuelType(fuel.fuelType)}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-[#18181b]">
                          R$ {fuel.price.toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs text-[#78716c]">
                          Atualizado em{' '}
                          {new Date(fuel.updatedAt).toLocaleDateString('pt-BR')}
                        </p>
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
                  <ThumbsUp className="mr-2 size-4" />
                  Reportar Preço
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
              </div>
            </article>
          )
        })}
      </div>

      {selectedStation ? (
        <PriceReportDialog
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
          onSubmit={() => setSelectedStation(null)}
        />
      ) : null}
    </>
  )
}

function reorderFuelPrices(
  prices: FuelPrice[],
  preferredFuelType?: FuelType
): FuelPrice[] {
  if (!preferredFuelType) {
    return prices
  }

  return [...prices].sort((priceA, priceB) => {
    if (priceA.fuelType === preferredFuelType) return -1
    if (priceB.fuelType === preferredFuelType) return 1
    return 0
  })
}

function formatFuelType(fuelType: FuelType): string {
  if (fuelType === 'GASOLINE') return 'Gasolina'
  if (fuelType === 'ETHANOL') return 'Etanol'
  if (fuelType === 'DIESEL') return 'Diesel'
  return 'GNV'
}
