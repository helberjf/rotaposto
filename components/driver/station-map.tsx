'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  CircleMarker,
  LayerGroup,
  Map as LeafletMap,
  Polyline,
  TileLayer,
} from 'leaflet'
import { Spinner } from '@/components/ui/spinner'

interface StationFuelPrice {
  fuelType: string
  price: number
  updatedAt: string
}

interface Station {
  id: string
  name: string
  address?: string
  lat: number
  lng: number
  brand?: string
  fuel_prices?: StationFuelPrice[]
}

type LeafletModule = typeof import('leaflet')
type MapLayerMode = 'map' | 'satellite'

export default function StationMap({
  stations,
  center,
  routePath = [],
  userLocation = null,
  tileMode = 'map',
  preferredFuelType,
}: {
  stations: Station[]
  center: [number, number]
  routePath?: Array<[number, number]>
  userLocation?: [number, number] | null
  tileMode?: MapLayerMode
  preferredFuelType?: string
}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const markersLayer = useRef<LayerGroup | null>(null)
  const routeLayer = useRef<Polyline | null>(null)
  const userLocationLayer = useRef<CircleMarker | null>(null)
  const baseLayer = useRef<TileLayer | null>(null)
  const [L, setL] = useState<LeafletModule | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const existingLink = document.getElementById(
      'fuelroute-leaflet-css'
    ) as HTMLLinkElement | null

    if (existingLink) {
      return
    }

    const link = document.createElement('link')
    link.id = 'fuelroute-leaflet-css'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    const loadLeaflet = async () => {
      const leaflet = await import('leaflet')
      setL(leaflet)
      setIsLoading(false)
    }

    void loadLeaflet()
  }, [])

  useEffect(() => {
    if (!mapContainer.current || !L) {
      return
    }

    if (map.current) {
      return
    }

    const mapInstance = L.map(mapContainer.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([center[0], center[1]], 12)

    map.current = mapInstance
    baseLayer.current = createTileLayer(L, tileMode)
    baseLayer.current.addTo(mapInstance)
    markersLayer.current = L.layerGroup().addTo(mapInstance)

    return () => {
      map.current?.remove()
      map.current = null
      markersLayer.current = null
      routeLayer.current = null
      userLocationLayer.current = null
      baseLayer.current = null
    }
  }, [L, center, tileMode])

  useEffect(() => {
    if (!map.current || !L) {
      return
    }

    if (baseLayer.current) {
      map.current.removeLayer(baseLayer.current)
    }

    baseLayer.current = createTileLayer(L, tileMode)
    baseLayer.current.addTo(map.current)
  }, [L, tileMode])

  useEffect(() => {
    if (!map.current || !L || !markersLayer.current) {
      return
    }

    markersLayer.current.clearLayers()

    if (routeLayer.current) {
      map.current.removeLayer(routeLayer.current)
      routeLayer.current = null
    }

    if (userLocationLayer.current) {
      map.current.removeLayer(userLocationLayer.current)
      userLocationLayer.current = null
    }

    if (routePath.length > 1) {
      routeLayer.current = L.polyline(routePath, {
        color: '#4f7cff',
        weight: 5,
        opacity: 0.9,
      }).addTo(map.current)
    }

    if (userLocation) {
      userLocationLayer.current = L.circleMarker(userLocation, {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#f97316',
        fillOpacity: 1,
      }).addTo(map.current)
    }

    const stationIcon = L.divIcon({
      className: 'custom-station-marker',
      html: `
        <div style="
          width: 34px;
          height: 34px;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 10px 20px rgba(249, 115, 22, 0.22);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/>
            <path d="M15 22V10a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>
            <path d="M3 22h12"/>
            <path d="M7 8h4"/>
            <path d="M7 12h4"/>
          </svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -16],
    })

    stations.forEach((station) => {
      const preferredFuel = station.fuel_prices?.find(
        (fuel) => fuel.fuelType === preferredFuelType
      )

      const marker = L.marker([station.lat, station.lng], { icon: stationIcon })
      marker.bindPopup(`
        <div style="min-width: 180px; padding: 4px 2px;">
          <div style="font-weight: 700; font-size: 14px; color: #18181b; margin-bottom: 4px;">
            ${station.name}
          </div>
          ${
            station.brand
              ? `<div style="font-size: 12px; color: #57534e; margin-bottom: 4px;">${station.brand}</div>`
              : ''
          }
          ${
            preferredFuel
              ? `<div style="font-size: 13px; color: #ea580c; font-weight: 700; margin-bottom: 4px;">${formatFuelType(
                  preferredFuel.fuelType
                )}: R$ ${preferredFuel.price.toFixed(2)}</div>`
              : ''
          }
          ${
            station.address
              ? `<div style="font-size: 12px; color: #78716c; line-height: 1.45;">${station.address}</div>`
              : ''
          }
        </div>
      `)

      markersLayer.current?.addLayer(marker)
    })

    const points: Array<[number, number]> = [
      ...routePath,
      ...stations.map((station) => [station.lat, station.lng] as [number, number]),
    ]

    if (userLocation) {
      points.push(userLocation)
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points)
      map.current.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 14,
      })
    } else {
      map.current.setView([center[0], center[1]], 12)
    }
  }, [L, center, preferredFuelType, routePath, stations, userLocation])

  useEffect(() => {
    if (!map.current) {
      return
    }

    const timer = window.setTimeout(() => {
      map.current?.invalidateSize()
    }, 120)

    return () => window.clearTimeout(timer)
  }, [isLoading, routePath.length, stations.length])

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#fcfbf8]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return <div ref={mapContainer} className="h-full w-full" />
}

function createTileLayer(L: LeafletModule, tileMode: MapLayerMode): TileLayer {
  if (tileMode === 'satellite') {
    return L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 19,
      }
    )
  }

  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  })
}

function formatFuelType(fuelType: string): string {
  if (fuelType === 'GASOLINE') return 'Gasolina'
  if (fuelType === 'ETHANOL') return 'Etanol'
  if (fuelType === 'DIESEL') return 'Diesel'
  if (fuelType === 'GNV') return 'GNV'
  return fuelType
}
