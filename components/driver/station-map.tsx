'use client'

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'

interface Station {
  id: string
  name: string
  lat: number
  lng: number
  brand?: string
}

type LeafletType = typeof import('leaflet')

export default function StationMap({ stations, center }: { stations: Station[], center: [number, number] }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markersLayer = useRef<L.LayerGroup | null>(null)
  const [L, setL] = useState<LeafletType | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load Leaflet CSS
  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [])

  // Dynamically import Leaflet
  useEffect(() => {
    const loadLeaflet = async () => {
      const leaflet = await import('leaflet')
      setL(leaflet.default)
      setIsLoading(false)
    }
    loadLeaflet()
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !L) return

    if (map.current) {
      map.current.setView([center[0], center[1]], 13)
      return
    }

    map.current = L.map(mapContainer.current).setView([center[0], center[1]], 13)

    // OpenStreetMap tiles - gratuito e sem necessidade de token
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map.current)

    // Create markers layer group
    markersLayer.current = L.layerGroup().addTo(map.current)

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [L, center])

  // Update markers when stations change
  useEffect(() => {
    if (!map.current || !L || !markersLayer.current) return

    // Clear existing markers
    markersLayer.current.clearLayers()

    // Custom icon for fuel stations
    const stationIcon = L.divIcon({
      className: 'custom-station-marker',
      html: `<div style="
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
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
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    })

    // Add markers for each station
    stations.forEach((station) => {
      const marker = L.marker([station.lat, station.lng], { icon: stationIcon })
        .bindPopup(`
          <div style="padding: 8px; min-width: 150px;">
            <h3 style="font-weight: bold; font-size: 14px; margin: 0 0 4px 0;">${station.name}</h3>
            ${station.brand ? `<p style="font-size: 12px; color: #6b7280; margin: 0;">${station.brand}</p>` : ''}
          </div>
        `)
      
      markersLayer.current!.addLayer(marker)
    })

    // Fit bounds if there are stations
    if (stations.length > 0) {
      const bounds = L.latLngBounds(stations.map(s => [s.lat, s.lng]))
      map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }
  }, [stations, L])

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return <div ref={mapContainer} className="w-full h-full" />
}
