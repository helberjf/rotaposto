// Haversine formula to calculate distance between two points in kilometers
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Decode Mapbox polyline (polyline6 format)
export function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    result = 0
    shift = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    coordinates.push([lng / 1e6, lat / 1e6])
  }

  return coordinates
}

// Check if user has enough fuel to reach a station
export function canReachStation(
  distanceKm: number,
  tankLiters: number,
  kmPerLiter: number
): boolean {
  const maxRange = tankLiters * kmPerLiter
  return distanceKm <= maxRange
}

// Calculate fuel cost to reach a station
export function calculateFuelCost(
  distanceKm: number,
  kmPerLiter: number,
  pricePerLiter: number
): number {
  const litersNeeded = distanceKm / kmPerLiter
  return litersNeeded * pricePerLiter
}

// Calculate potential savings between two stations
export function calculateSavings(
  distanceToStationA: number,
  distanceToStationB: number,
  priceA: number,
  priceB: number,
  kmPerLiter: number,
  litersToFill: number
): number {
  const costA = (distanceToStationA / kmPerLiter) * priceA + litersToFill * priceA
  const costB = (distanceToStationB / kmPerLiter) * priceB + litersToFill * priceB
  return costA - costB
}

// Find point on route closest to a station
export function findClosestPointOnRoute(
  stationLat: number,
  stationLng: number,
  routeCoordinates: [number, number][]
): { distance: number; index: number } {
  let minDistance = Infinity
  let closestIndex = 0

  for (let i = 0; i < routeCoordinates.length; i++) {
    const [lng, lat] = routeCoordinates[i]
    const dist = calculateDistance(stationLat, stationLng, lat, lng)
    if (dist < minDistance) {
      minDistance = dist
      closestIndex = i
    }
  }

  return { distance: minDistance, index: closestIndex }
}

// Calculate route progress percentage for a station
export function calculateRouteProgress(
  stationIndex: number,
  totalPoints: number
): number {
  return (stationIndex / totalPoints) * 100
}
