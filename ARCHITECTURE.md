# Rotaposto — Arquitetura e Documentação Técnica

> Webapp de localização de postos de gasolina com preços colaborativos, sugestões moderadas e painel para proprietários.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript |
| Estilo | Tailwind CSS v4 + shadcn/ui |
| Banco de dados | NeonDB (PostgreSQL serverless + PostGIS) |
| ORM / Query | `@neondatabase/serverless` (tagged SQL) — Prisma apenas para schema |
| Auth | NextAuth.js v4 (CredentialsProvider) |
| Geocodificação | Nominatim / OpenStreetMap |
| Roteamento | OSRM (router.project-osrm.org) |
| Package manager | pnpm |
| Testes | Vitest |

---

## Variáveis de Ambiente

```env
# Obrigatórias
DATABASE_URL=postgresql://...          # URL pooled (NeonDB)
DATABASE_URL_UNPOOLED=postgresql://... # URL direta (scripts, migrações)
NEXTAUTH_SECRET=...                    # Segredo do NextAuth
NEXTAUTH_URL=https://...               # URL pública da aplicação

# Admin do sistema (moderação de sugestões)
ADMIN_EMAIL=seu@email.com             # Email com acesso à aba Sugestões no dashboard
```

---

## Banco de Dados

### Models (Prisma Schema)

#### `StationOwner`
Proprietários de postos que se registram para gerenciar preços oficiais.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `cuid` | Chave primária |
| `email` | `String` unique | Login do proprietário |
| `password` | `String` | Hash bcrypt |
| `name` | `String` | Nome exibido |
| `stations` | `Station[]` | Postos do dono |

#### `Station`
Posto de combustível. Alimentado por proprietários (`source=OWNER`) ou aprovado de sugestões de motoristas (`source=DRIVER`).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `String` | Prefixo `station_` |
| `name` | `String` | Nome do posto |
| `cnpj` | `String?` | CNPJ (opcional) |
| `address` | `String` | Endereço legível |
| `lat`, `lng` | `Float` | Coordenadas |
| `location` | `geography(Point,4326)` | Coluna PostGIS — gerada por trigger |
| `brand` | `String?` | Bandeira (Shell, Ipiranga…) |
| `phone` | `String?` | Telefone |
| `source` | `StationSource` | `OWNER` ou `DRIVER` |
| `isVerified` | `Boolean` | Se o posto foi verificado |
| `ownerId` | `String?` | FK para `StationOwner` |

> **Trigger:** `station_location_trigger` — atualiza `location` automaticamente em INSERT/UPDATE de `lat`/`lng`.

#### `FuelPrice`
Preços oficiais definidos pelo proprietário do posto.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `cuid` | |
| `fuelType` | `FuelType` | GASOLINE / ETHANOL / DIESEL / GNV |
| `price` | `Float` | Preço em R$ |
| `updatedAt` | `DateTime` | Última atualização |
| `stationId` | `String` | FK para `Station` |

Constraint única: `(stationId, fuelType)` — um preço por tipo de combustível por posto.

#### `DriverPriceReport`
Reporte colaborativo de preço por um motorista.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `String` | Prefixo `report_` |
| `fuelType` | `FuelType` | |
| `price` | `Float` | Preço reportado |
| `reporterHash` | `String` | SHA-256 de IP+UserAgent (anonimizado) |
| `reporterLat`, `reporterLng` | `Float` | Localização do motorista (validação de proximidade) |
| `createdAt` | `DateTime` | |
| `stationId` | `String` | FK para `Station` |

#### `StationSuggestion`
Fila de moderação de postos sugeridos por motoristas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `String` | Prefixo `sug_` |
| `name`, `address` | `String` | Dados do posto |
| `lat`, `lng` | `Float` | |
| `brand`, `phone` | `String?` | |
| `status` | `SuggestionStatus` | `PENDING` / `APPROVED` / `REJECTED` |
| `rejectionReason` | `String?` | Motivo do admin ao rejeitar |
| `createdAt`, `updatedAt` | `DateTime` | |

### Enums

```
FuelType:        GASOLINE | ETHANOL | DIESEL | GNV
StationSource:   OWNER | DRIVER
SuggestionStatus: PENDING | APPROVED | REJECTED
```

---

## Páginas (Rotas de Frontend)

| Rota | Arquivo | Quem acessa |
|------|---------|-------------|
| `/` | `app/page.tsx` | Público — landing / redirect |
| `/driver` | `app/driver/page.tsx` | Motoristas |
| `/owner/login` | `app/owner/login/page.tsx` | Proprietários |
| `/owner/register` | `app/owner/register/page.tsx` | Proprietários |
| `/owner/dashboard` | `app/owner/dashboard/page.tsx` | Proprietários autenticados |

---

## Fluxos do Usuário

### Fluxo 1 — Motorista: Busca por Raio

```
1. /driver carrega
2. Usuário preenche endereço (LocationAutocompleteInput → /api/geocode)
   OU clica "Usar minha localização" (GPS → /api/geocode/reverse)
3. Seleciona raio (1–50 km)
4. Clica "Buscar postos"
5. → GET /api/stations/nearby?lat=&lng=&radius=&limit=10&offset=0
6. Exibe lista (StationList) + mapa (StationMap)
   - Header mostra total: "X postos encontrados a N km"
   - Botões de ordenação: Distância / Preço
7. Scroll até o final da lista → IntersectionObserver aciona
   → GET /api/stations/nearby?...&offset=10 (load more)
8. Clicar em um posto abre StationMap com destaque
```

### Fluxo 2 — Motorista: Busca por Rota

```
1. Na aba "Por rota" do /driver
2. Usuário preenche origem e destino
3. → GET /api/directions?originLat=&originLng=&destinationLat=&destinationLng=
   (OSRM → polyline encoded)
4. → GET /api/stations/route-search?polyline=&bufferDistance=2000
   (PostGIS ST_Intersects com buffer de 2km ao redor da rota)
5. Exibe postos no corredor da rota no mapa
```

### Fluxo 3 — Motorista: Atualizar Preço Colaborativo

```
1. Motorista encontra posto na lista
2. Clica em "Atualizar preço" (StationPriceSearch / PriceReportDialog)
3. Busca posto: GET /api/stations/search?q=&city=&neighborhood=
4. Seleciona posto + combustível + preço + confirma localização GPS
5. → POST /api/prices/report
   Validações:
   a. Distância máx 500m do posto (PostGIS)
   b. Máx 3 reportes por hora (mesmo reporterHash)
   c. Máx 1 reporte do mesmo combustível no mesmo posto por hora
   d. Desvio máx 10% do preço de referência atual (community ou owner price)
6. Salva DriverPriceReport
7. Retorna communityPrice (média dos últimos 7 dias)
```

### Fluxo 4 — Motorista: Sugerir Novo Posto

```
1. Motorista clica "Adicionar posto" (StationSuggestionForm)
2. Preenche: nome, bandeira, CEP, telefone, endereço
   - CEP → ViaCEP preenche endereço automaticamente
   - "Minha localização" → GPS + /api/geocode/reverse
   - LocationAutocompleteInput → /api/geocode
3. Clica "Enviar para revisão"
4. Sistema geocodifica se coords não resolvidas → GET /api/geocode
5. → GET /api/stations/suggest/check?lat=&lng=&radius=200
   Se encontrar postos num raio de 200m:
   → Exibe card amarelo "Encontramos postos próximos — é um deles?"
     - "Sim, é esse" → fecha o form (não cria nada)
     - "Não, é diferente — continuar" → segue para passo 6
6. → POST /api/stations/suggest
   Validações:
   a. Não existe Station com mesmo nome a ≤50m
   b. Não existe StationSuggestion PENDING com mesmo nome na área (~220m)
7. Cria StationSuggestion com status=PENDING
8. Motorista vê: "Sugestão enviada! O posto aparecerá no mapa após revisão."
```

### Fluxo 5 — Admin: Moderar Sugestões

```
1. Admin faz login em /owner/login com email = ADMIN_EMAIL
2. Dashboard carrega e tenta GET /api/owner/station-suggestions
   → 200: exibe aba "Sugestões" com badge laranja (contagem PENDING)
   → 403: aba fica oculta (usuário não é admin)
3. Para cada sugestão PENDING, admin pode:
   - Aprovar → PATCH /api/owner/station-suggestions { action: "APPROVED" }
     → Cria Station real (source=DRIVER, isVerified=false)
     → Trigger popula location automaticamente
     → Atualiza status para APPROVED
   - Rejeitar → prompt para motivo → PATCH { action: "REJECTED", rejectionReason }
     → Atualiza status para REJECTED, salva motivo
```

### Fluxo 6 — Proprietário: Gerenciar Postos e Preços

```
1. Proprietário se registra em /owner/register
   → POST /api/auth/register (cria StationOwner com bcrypt hash)
2. Login em /owner/login → NextAuth CredentialsProvider
3. Dashboard /owner/dashboard:
   a. GET /api/owner/stations → lista postos do dono (filtrado por ownerId)
   b. Cria posto: POST /api/owner/stations (source=OWNER)
   c. Edita posto: PATCH /api/owner/stations/[id]
   d. Atualiza preço: PATCH /api/owner/stations/[id]/prices
      → INSERT ... ON CONFLICT (stationId, fuelType) DO UPDATE
```

---

## API Reference

### Autenticação

#### `GET|POST /api/auth/[...nextauth]`
Gerenciado pelo NextAuth. Endpoints: `/api/auth/signin`, `/api/auth/signout`, `/api/auth/session`, `/api/auth/callback/credentials`.

---

### Postos — Público

#### `GET /api/stations/nearby`
Busca postos num raio geográfico. Suporta paginação server-side.

**Query params:**
| Param | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `lat` | number | — | Latitude do centro |
| `lng` | number | — | Longitude do centro |
| `radius` | number | 2000 | Raio em metros |
| `limit` | int (1–50) | 10 | Postos por página |
| `offset` | int | 0 | Paginação |

**Resposta:** `{ stations: Station[], total: number }`

Cada Station inclui `owner_prices` (FuelPrice[]) e `community_prices` (médias dos reportes dos últimos 7 dias com `reportCount`).

---

#### `GET /api/stations/search`
Busca textual/geográfica de postos para o painel de atualização de preços.

**Query params:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| `q` | string (default `''`) | Nome ou endereço (ILIKE) |
| `city` | string? | Filtra por cidade no endereço |
| `neighborhood` | string? | Filtra por bairro no endereço |

**Resposta:** `Station[]` (máx 20, ordenado por nome)

---

#### `GET /api/stations/[id]`
Detalhes de um posto específico com preços owner e community.

**Resposta:** `Station` com `owner_prices` e `community_prices`

---

#### `GET /api/stations/route-search`
Postos dentro do corredor de uma rota (buffer PostGIS).

**Query params:**
| Param | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `polyline` | string | — | Polyline encoded (OSRM format) |
| `bufferDistance` | number | 2000 | Buffer em metros ao redor da rota |

**Resposta:** `Station[]` (máx 100, ordenado por nome)

---

#### `GET /api/stations/suggest/check`
Verifica postos existentes próximos a coordenadas (pré-checagem antes de sugerir).

**Query params:** `lat`, `lng`, `radius` (default 200m)

**Resposta:** `Array<{ id, name, address, brand, distance }>` (máx 5, ordenado por distance)

---

#### `POST /api/stations/suggest`
Envia sugestão de novo posto para fila de moderação.

**Body:**
```json
{
  "name": "Posto Central",
  "address": "Rua das Flores, 123, Bairro, Cidade – SP",
  "lat": -23.5629,
  "lng": -46.6544,
  "brand": "Shell",     // opcional
  "phone": "(11) 9999-9999"  // opcional
}
```

**Validações:**
- Sem Station com mesmo nome num raio de 50m
- Sem StationSuggestion PENDING com mesmo nome a ~220m (0.002° lat/lng)

**Resposta:** `{ success: true }` 201

**Erros:** 409 duplicata, 400 dados inválidos

---

### Preços — Público

#### `POST /api/prices/report`
Reporte colaborativo de preço por motorista.

**Body:**
```json
{
  "stationId": "station_...",
  "fuelType": "GASOLINE",
  "price": 5.89,
  "reporterLat": -23.5629,
  "reporterLng": -46.6544
}
```

**Validações (nessa ordem):**
1. Posto existe
2. Motorista a ≤ 500m do posto (PostGIS)
3. Máx 3 reportes/hora pelo mesmo `reporterHash`
4. Máx 1 reporte do mesmo combustível no mesmo posto por hora
5. Desvio ≤ 10% do preço de referência (community price 7d → ou owner price)

**Anonimização:** `reporterHash = SHA-256(ip:userAgent:NEXTAUTH_SECRET)`. Se IP/UA indisponíveis, usa coordenada arredondada a 2 casas.

**Resposta:** `{ success: true, reportId, communityPrice }`

---

### Geocodificação — Público

Todos os endpoints abaixo são proxies para o Nominatim (OpenStreetMap), com `User-Agent: Rotaposto/1.0` e `Accept-Language: pt-BR`.

#### `GET /api/geocode`
Geocodificação direta (endereço → coords).

**Query:** `q` (min 3 chars)

**Resposta:** `{ lat, lng, label }` ou 404

---

#### `GET /api/geocode/reverse`
Geocodificação reversa (coords → endereço).

**Query:** `lat`, `lng`

**Resposta:** `{ lat, lng, label }`

---

#### `GET /api/geocode/cities`
Autocomplete de cidades brasileiras via Nominatim (place_rank 12–16).

**Query:** `q` (min 2 chars)

**Resposta:** `Array<{ label: "Juiz de Fora - MG", city: "Juiz de Fora" }>` (máx 6, cache 24h)

---

#### `GET /api/geocode/neighborhoods`
Autocomplete de bairros de uma cidade via Nominatim.

**Query:** `q` (texto de busca), `city` (nome da cidade)

**Extrai campos:** `suburb`, `neighbourhood`, `quarter`, `village` dos resultados Nominatim.

**Resposta:** `string[]` (bairros únicos, cache 1h)

---

### Direções — Público

#### `GET /api/directions`
Calcula rota entre dois pontos via OSRM (router.project-osrm.org).

**Query:** `originLat`, `originLng`, `destinationLat`, `destinationLng`

**Resposta:**
```json
{
  "polyline": "encoded...",
  "distanceMeters": 12345,
  "durationSeconds": 900,
  "routes": [{ "polyline", "distanceMeters", "durationSeconds" }]
}
```

Retorna até 3 rotas alternativas.

---

### Owner (Proprietário) — Requer autenticação NextAuth

#### `GET /api/owner/stations`
Lista postos do proprietário autenticado.

**Resposta:** `Station[]` (filtrado por `ownerId`, sem preços)

---

#### `POST /api/owner/stations`
Cria novo posto para o proprietário.

**Body:** `{ name, cnpj?, address, lat, lng, brand?, phone? }`

**Resposta:** `Station` 201

---

#### `GET /api/owner/stations/[id]`
Detalhes de um posto do proprietário (inclui `fuel_prices`).

**Segurança:** Só retorna se `ownerId === session.user.id`

---

#### `PATCH /api/owner/stations/[id]`
Atualiza dados cadastrais de um posto.

**Body:** `{ name, cnpj?, address, lat, lng, brand?, phone? }`

**Segurança:** Só atualiza se `ownerId === session.user.id`

---

#### `PATCH /api/owner/stations/[id]/prices`
Cria ou atualiza preço oficial de um combustível.

**Body:** `{ fuelType, price }`

Usa `INSERT ... ON CONFLICT (stationId, fuelType) DO UPDATE`.

---

### Admin (Sistema) — Requer `ADMIN_EMAIL`

#### `GET /api/owner/station-suggestions`
Lista todas as sugestões de postos (max 100), ordenadas por: PENDING primeiro, depois por data DESC.

**Auth:** Session email deve ser igual a `process.env.ADMIN_EMAIL`. Retorna 403 caso contrário.

---

#### `PATCH /api/owner/station-suggestions`
Aprova ou rejeita uma sugestão.

**Body:**
```json
{
  "id": "sug_...",
  "action": "APPROVED",        // ou "REJECTED"
  "rejectionReason": "..."     // opcional, só para REJECTED
}
```

**Se APPROVED:**
1. Lê a StationSuggestion
2. Cria `Station` (source=DRIVER, isVerified=false)
3. Trigger DB popula `location` automaticamente
4. Atualiza `StationSuggestion.status = 'APPROVED'`

---

## Componentes Principais

### Driver

| Componente | Arquivo | Função |
|-----------|---------|--------|
| `StationList` | `components/driver/station-list.tsx` | Lista de postos com infinite scroll (IntersectionObserver) |
| `StationMap` | `components/driver/station-map.tsx` | Mapa interativo com pins |
| `StationSuggestionForm` | `components/driver/station-suggestion-form.tsx` | Form em 3 etapas: geocode → check duplicatas → submit |
| `PriceReportDialog` | `components/driver/price-report-dialog.tsx` | Dialog para reportar preço |
| `RadiusSearchForm` | `components/driver/radius-search-form.tsx` | Formulário de busca por raio |
| `RouteSearchForm` | `components/driver/route-search-form.tsx` | Formulário de busca por rota |
| `StationPriceSearch` | `components/driver/station-price-search.tsx` | Busca por nome/cidade/bairro para atualizar preço |

### Owner

| Componente | Arquivo | Função |
|-----------|---------|--------|
| `StationForm` | `components/owner/station-form.tsx` | Criar/editar posto |
| `StationCard` | `components/owner/station-card.tsx` | Card do posto no dashboard |
| `PriceForm` | `components/owner/price-form.tsx` | Formulário de preços |

### Shared

| Componente | Arquivo | Função |
|-----------|---------|--------|
| `LocationAutocompleteInput` | `components/location-autocomplete-input.tsx` | Input com autocomplete via `/api/geocode` |

---

## Biblioteca `lib/`

| Arquivo | Exporta |
|---------|---------|
| `lib/db.ts` | `getSql()` — instância do cliente Neon com a connection string |
| `lib/auth.ts` | `hashPassword`, `verifyPassword`, `getStationOwnerByEmail`, `getStationOwnerById` |
| `lib/geo.ts` | `calculateDistance` (Haversine), `decodePolyline` (polyline6), `canReachStation`, `calculateFuelCost`, `calculateSavings` |
| `lib/anonymize.ts` | `createReporterHash` (SHA-256 de IP+UA+secret), `anonymizeLocation` (coords arredondadas), `isWithinReportingDistance`, `checkRateLimit` |
| `lib/validations.ts` | Schemas Zod reutilizáveis + `formatPrice`, `formatCNPJ`, `formatPhone` |
| `lib/utils.ts` | `cn()` (clsx + twMerge) |

---

## Scripts de Banco

| Arquivo | Propósito |
|---------|-----------|
| `scripts/000-init-schema.sql` | Schema inicial |
| `scripts/001-setup-postgis.sql` | Extensão PostGIS + coluna `location` + trigger |
| `scripts/002-seed-data.sql` | Dados de exemplo |
| `scripts/003-...` | (se houver) |
| `scripts/004-add-station-suggestions.sql` | Tabela `StationSuggestion` + índice |
| `scripts/init-neon-db.mjs` | Script ESM para inicializar o banco do zero (schema + seed) |

---

## Segurança

| Controle | Implementação |
|----------|---------------|
| Autenticação de proprietários | NextAuth CredentialsProvider + bcrypt |
| Autorização de dono do posto | Todas as queries owner filtram por `ownerId = session.user.id` |
| Admin do sistema | Comparação `session.user.email === ADMIN_EMAIL` no servidor |
| Anonimização de reporters | SHA-256(IP:UA:secret) — nunca armazena IP bruto |
| Rate limiting de reportes | 3 reportes/hora por hash + 1/hora por posto+combustível |
| Validação de proximidade | `ST_DWithin` PostGIS ≤ 500m para reportes de preço |
| Anti-spam de sugestões | Checa duplicata a ≤50m (Station) e ~220m (sugestão pendente) |
| Validação de entrada | Zod em todas as APIs |

---

## Modelo de Preços

```
Para cada combustível de um posto, há duas fontes de preço:

owner_prices        → FuelPrice: preço oficial do proprietário
community_prices    → média de DriverPriceReport dos últimos 7 dias

Os dois são exibidos lado a lado na UI.
Reportes fora de ±10% do preço de referência são rejeitados (status 422).
```

---

## Paginação de Postos (`/api/stations/nearby`)

```
- Server-side pagination com LIMIT/OFFSET
- COUNT(*) OVER() retorna total em cada linha (window function)
- StationList usa IntersectionObserver num sentinel invisível no fim da lista
- isFreshSearchRef: só faz scrollIntoView quando offset=0 (busca nova)
- loadMoreStations: incrementa offset em 10 e concatena ao array existente
```
