import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const STATE_ABBR: Record<string, string> = {
  Acre: 'AC',
  Alagoas: 'AL',
  'Amapá': 'AP',
  Amazonas: 'AM',
  Bahia: 'BA',
  'Ceará': 'CE',
  'Distrito Federal': 'DF',
  'Espírito Santo': 'ES',
  'Goiás': 'GO',
  'Maranhão': 'MA',
  'Mato Grosso': 'MT',
  'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG',
  'Pará': 'PA',
  'Paraíba': 'PB',
  'Paraná': 'PR',
  Pernambuco: 'PE',
  'Piauí': 'PI',
  'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS',
  'Rondônia': 'RO',
  Roraima: 'RR',
  'Santa Catarina': 'SC',
  'São Paulo': 'SP',
  Sergipe: 'SE',
  Tocantins: 'TO',
}

interface NominatimResult {
  name: string
  display_name: string
  type: string
  class: string
  place_rank: number
  address: {
    city?: string
    town?: string
    municipality?: string
    county?: string
    state?: string
  }
}

export interface CityOption {
  label: string // "Juiz de Fora - MG"
  city: string  // "Juiz de Fora"
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    z.string().min(2).max(100).parse(q)

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '10')
    url.searchParams.set('countrycodes', 'br')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('dedupe', '1')
    url.searchParams.set('q', q)

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'Rotaposto/1.0',
      },
      next: { revalidate: 86400 },
    })

    if (!response.ok) throw new Error('Nominatim error')

    const results = (await response.json()) as NominatimResult[]

    const seen = new Set<string>()
    const cities: CityOption[] = []

    for (const r of results) {
      // place_rank 12–16 = city / town level in Nominatim
      if (r.place_rank < 12 || r.place_rank > 16) continue

      const cityName =
        r.address.city ||
        r.address.town ||
        r.address.municipality ||
        r.name

      if (!cityName || seen.has(cityName.toLowerCase())) continue
      seen.add(cityName.toLowerCase())

      const state = r.address.state ?? ''
      const stateAbbr = STATE_ABBR[state] ?? state.slice(0, 2).toUpperCase()

      cities.push({ label: `${cityName} - ${stateAbbr}`, city: cityName })

      if (cities.length === 6) break
    }

    return NextResponse.json(cities)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
