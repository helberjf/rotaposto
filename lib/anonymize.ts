import { createHash } from 'node:crypto'

// Create a hash from IP and user agent for anonymous identification
export async function createReporterHash(
  ip: string,
  userAgent: string
): Promise<string> {
  const data = `${ip}:${userAgent}:${process.env.NEXTAUTH_SECRET || 'salt'}`
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Hash a coarse-grained location so repeated reports can be grouped
// without storing a reversible precise coordinate fingerprint.
export function anonymizeLocation(lat: number, lng: number): string {
  const roundedLat = lat.toFixed(2)
  const roundedLng = lng.toFixed(2)

  return createHash('sha256')
    .update(`${roundedLat}:${roundedLng}:${process.env.NEXTAUTH_SECRET || 'salt'}`)
    .digest('hex')
}

// Check if reporter is within acceptable distance from station (500m)
export function isWithinReportingDistance(
  reporterLat: number,
  reporterLng: number,
  stationLat: number,
  stationLng: number,
  maxDistanceMeters: number = 500
): boolean {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRad(stationLat - reporterLat)
  const dLng = toRad(stationLng - reporterLng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(reporterLat)) * Math.cos(toRad(stationLat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance <= maxDistanceMeters
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Rate limiting check - returns true if within limits
export async function checkRateLimit(
  reporterHash: string,
  stationId: string,
  recentReportsCount: number,
  maxReportsPerHour: number = 3
): Promise<boolean> {
  return recentReportsCount < maxReportsPerHour
}
