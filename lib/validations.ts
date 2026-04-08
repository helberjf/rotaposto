import { z } from 'zod'

// Fuel types enum
export const FuelTypeEnum = z.enum(['GASOLINE', 'ETHANOL', 'DIESEL', 'GNV'])
export type FuelType = z.infer<typeof FuelTypeEnum>

export const fuelTypeLabels: Record<FuelType, string> = {
  GASOLINE: 'Gasolina',
  ETHANOL: 'Etanol',
  DIESEL: 'Diesel',
  GNV: 'GNV',
}

// Coordinate validation
export const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

// Nearby search schema
export const nearbySearchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(50).default(10),
  fuelType: FuelTypeEnum.optional(),
})

// Route search schema
export const routeSearchSchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  fuelType: FuelTypeEnum,
  kmPerLiter: z.number().min(1).max(50).optional(),
  tankLiters: z.number().min(1).max(200).optional(),
  corridorWidthKm: z.number().min(1).max(20).default(5),
})

// Driver price report schema
export const driverReportSchema = z.object({
  stationId: z.string().min(1),
  fuelType: FuelTypeEnum,
  price: z.number().min(0.01).max(20),
  reporterLat: z.number().min(-90).max(90),
  reporterLng: z.number().min(-180).max(180),
})

// Station suggestion schema (by driver)
export const stationSuggestionSchema = z.object({
  name: z.string().min(3).max(100),
  address: z.string().min(5).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  brand: z.string().max(50).optional(),
  prices: z.array(z.object({
    fuelType: FuelTypeEnum,
    price: z.number().min(0.01).max(20),
  })).min(1),
})

// Owner authentication schemas
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
})

// Station creation/edit schema (by owner)
export const stationSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido').optional().or(z.literal('')),
  address: z.string().min(5, 'Endereço deve ter no mínimo 5 caracteres').max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  brand: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
})

// Price update schema (by owner)
export const priceUpdateSchema = z.object({
  prices: z.array(z.object({
    fuelType: FuelTypeEnum,
    price: z.number().min(0.01).max(20),
  })).min(1),
})

// Format price for display
export function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

// Format CNPJ
export function formatCNPJ(value: string): string {
  const numbers = value.replace(/\D/g, '')
  return numbers
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18)
}

// Format phone
export function formatPhone(value: string): string {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 10) {
    return numbers
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return numbers
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15)
}
