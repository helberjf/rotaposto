# 🚗⛽ PROMPT — FuelRoute Webapp (Next.js + Prisma + PostgreSQL/PostGIS)

## VISÃO GERAL DO PROJETO

Crie um webapp completo chamado **FuelRoute** usando **Next.js 14 (App Router)**, **PostgreSQL com extensão PostGIS**, **Prisma ORM**, **NextAuth.js**, **Tailwind CSS** e **shadcn/ui**.

O app possui dois perfis:
- **Motorista** (sem login): pesquisa postos por rota ou raio geográfico, **e também pode cadastrar novos postos e reportar preços** de forma colaborativa/anônima
- **Dono de Posto** (com login): cadastra e atualiza preços do seu posto de forma oficial

Os postos exibem **duas fontes de preço separadas e identificadas visualmente**: o preço oficial do dono e o preço reportado por motoristas (crowdsourcing), cada um com seu timestamp.

---

## STACK COMPLETA

- **Framework**: Next.js 14 com App Router e TypeScript
- **Banco de dados**: PostgreSQL + extensão PostGIS (via Neon ou Supabase)
- **ORM**: Prisma (com suporte a `$queryRaw` para queries geoespaciais)
- **Autenticação**: NextAuth.js com provider Credentials (email + senha)
- **Mapa**: Mapbox GL JS (ou Google Maps API — configurável por variável de ambiente)
- **Geocodificação/Rotas**: Mapbox Directions API (ou Google Directions API)
- **Estilos**: Tailwind CSS + shadcn/ui
- **Deploy alvo**: Vercel + Neon Postgres

---

## MODELAGEM DO BANCO (Prisma Schema)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model StationOwner {
  id        String    @id @default(cuid())
  email     String    @unique
  password  String    // bcrypt hash
  name      String
  stations  Station[]
  createdAt DateTime  @default(now())
}

model Station {
  id           String        @id @default(cuid())
  name         String
  cnpj         String?       @unique // opcional para postos cadastrados por motoristas
  address      String
  lat          Float
  lng          Float
  brand        String?
  phone        String?
  source       StationSource @default(OWNER)   // quem cadastrou
  isVerified   Boolean       @default(false)   // true = verificado pelo dono; false = enviado por motorista
  owner        StationOwner? @relation(fields: [ownerId], references: [id])
  ownerId      String?
  prices       FuelPrice[]          // preços oficiais (dono)
  driverReports DriverPriceReport[] // preços reportados por motoristas
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

// Preços oficiais — só o dono pode inserir/editar
model FuelPrice {
  id        String    @id @default(cuid())
  station   Station   @relation(fields: [stationId], references: [id])
  stationId String
  fuelType  FuelType
  price     Decimal   @db.Decimal(6, 3)
  updatedAt DateTime  @default(now())

  @@unique([stationId, fuelType])
}

// Preços reportados por motoristas — crowdsourcing anônimo
model DriverPriceReport {
  id               String    @id @default(cuid())
  station          Station   @relation(fields: [stationId], references: [id])
  stationId        String
  fuelType         FuelType
  price            Decimal   @db.Decimal(6, 3)
  // Localização do motorista no momento do report (prova de presença)
  reporterLat      Float
  reporterLng      Float
  reporterAddress  String?   // endereço reverso geocodificado
  // Identificação anônima (sem login)
  reporterIp       String?   // hash do IP para evitar spam
  reporterDevice   String?   // hash do user-agent
  reportedAt       DateTime  @default(now())
}

enum FuelType {
  GASOLINE
  ETHANOL
  DIESEL
  GNV
}

enum StationSource {
  OWNER    // cadastrado pelo dono (verificado)
  DRIVER   // sugerido por motorista (não verificado)
}
```

> **IMPORTANTE**: Após criar as tabelas via Prisma, execute no banco:
> ```sql
> CREATE EXTENSION IF NOT EXISTS postgis;
> ALTER TABLE "Station" ADD COLUMN location geography(Point, 4326);
> UPDATE "Station" SET location = ST_MakePoint(lng, lat)::geography;
> CREATE INDEX station_location_idx ON "Station" USING GIST(location);
> -- Índice para reports de motoristas (busca por posto + tipo + data)
> CREATE INDEX driver_report_station_fuel_idx ON "DriverPriceReport" ("stationId", "fuelType", "reportedAt" DESC);
> ```

---

## ESTRUTURA DE PASTAS

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                         ← Home do motorista (mapa + seletor de fluxo)
│   ├── search/
│   │   └── page.tsx                     ← Fluxo 2: busca por raio
│   ├── report/
│   │   └── page.tsx                     ← Fluxo do motorista: reportar posto/preço
│   ├── owner/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── dashboard/
│   │       ├── page.tsx                 ← Painel do dono
│   │       ├── station/
│   │       │   ├── new/page.tsx         ← Cadastro de posto
│   │       │   └── [id]/page.tsx        ← Editar posto e preços
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── stations/
│       │   ├── route.ts                 ← GET listar / POST criar (dono)
│       │   └── [id]/route.ts            ← PUT / DELETE
│       ├── stations/nearby/route.ts     ← Query geoespacial por raio
│       ├── stations/along-route/route.ts← Postos no corredor da rota
│       ├── stations/report/route.ts     ← POST: motorista sugere novo posto
│       ├── prices/
│       │   └── [stationId]/route.ts     ← PUT atualizar preços (dono)
│       └── driver-reports/
│           └── route.ts                 ← POST: motorista reporta preço num posto existente
├── components/
│   ├── map/
│   │   ├── RouteMap.tsx                 ← Mapa do Fluxo 1 (rota)
│   │   └── RadiusMap.tsx                ← Mapa do Fluxo 2 (raio)
│   ├── driver/
│   │   ├── FlowSelector.tsx             ← Botões de seleção de fluxo
│   │   ├── RouteForm.tsx                ← Formulário do fluxo de rota
│   │   ├── RadiusForm.tsx               ← Formulário do fluxo de raio
│   │   ├── StationCard.tsx             ← Card de posto com preço duplo (dono + motorista)
│   │   ├── PriceSourceBadge.tsx        ← Badge visual diferenciando fonte do preço
│   │   └── ReportStationForm.tsx       ← Formulário de contribuição do motorista
│   ├── owner/
│   │   ├── StationForm.tsx
│   │   └── PriceUpdateForm.tsx
│   └── ui/                              ← shadcn/ui components
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── geo.ts                           ← Helpers: distância, corredor de rota
│   ├── anonymize.ts                     ← Hash de IP/device para anti-spam
│   └── validations.ts                   ← Zod schemas
└── types/
    └── index.ts
```

---

## FLUXOS DO MOTORISTA

### 🔘 Seletor de Fluxo (componente `FlowSelector.tsx`)

Na página inicial (`/`), exibir dois botões grandes e visualmente distintos **antes** do mapa ser utilizado. O **Fluxo 1 (Rota)** deve estar **selecionado por padrão**.

```
┌────────────────────────┐    ┌────────────────────────┐
│  🗺️  ROTA COM POSTOS   │    │  📍 BUSCA POR RAIO     │
│  [SELECIONADO PADRÃO]  │    │                        │
│  Informe origem e      │    │  Pesquise postos numa  │
│  destino — veja os     │    │  área ao redor de      │
│  postos mais baratos   │    │  qualquer localização  │
│  no caminho            │    │  por raio customizado  │
└────────────────────────┘    └────────────────────────┘
```

Ao clicar num botão, o formulário e o mapa abaixo se adaptam ao fluxo escolhido **sem navegar de página** (state local com `useState`).

---

### FLUXO 1 — Rota com Postos (padrão)

**Formulário `RouteForm.tsx`** com os seguintes campos:

| Campo | Obrigatório | Detalhe |
|---|---|---|
| Origem | ✅ Sim | Input com autocomplete de endereço (Mapbox Places) |
| Destino | ✅ Sim | Input com autocomplete de endereço |
| Tipo de combustível | ✅ Sim | Select: Gasolina / Etanol / Diesel / GNV |
| Consumo do carro (km/l) | ✅ Sim | Input numérico (ex: 12.5) |
| Combustível atual no tanque (litros) | ❌ **Opcional** | Input numérico com label "Opcional — para calcular se você chega" |

**Comportamento:**
1. Usuário preenche formulário e clica em "Calcular Rota"
2. API busca a rota entre origem e destino via Directions API
3. A rota retorna uma `polyline` de coordenadas
4. API `GET /api/stations/along-route` recebe a polyline + tipo de combustível + raio do corredor (padrão 5 km)
5. Query no banco encontra todos os postos dentro do corredor com PostGIS (`ST_DWithin`)
6. Postos são ordenados por preço (menor primeiro)
7. Mapa renderiza: rota em azul + marcadores dos postos (verde = mais barato, vermelho = mais caro, gradiente)
8. Painel lateral lista os postos com:
   - Nome, endereço, preço do combustível selecionado
   - **Se km/l e litros no tanque foram informados**: mostra se o motorista consegue chegar até aquele posto e o custo estimado da parada
   - **Se litros no tanque NÃO foi informado**: mostra apenas o custo estimado de abastecimento completo e economia vs. posto mais caro
9. Ao clicar no posto: exibe popup com todos os preços + botão "Abrir no GPS"

**Lógica de cálculo (lib/geo.ts):**
```typescript
// Distância total da rota em km (retornada pela Directions API)
// Custo da viagem = (distanciaKm / consumoKmL) * precoPosto
// Se litrosNoTanque informado:
//   autonomiaAtual = litrosNoTanque * consumoKmL
//   chegaAoPosto = distanciaAtePosto <= autonomiaAtual (boolean)
```

---

### FLUXO 2 — Busca por Raio

**Formulário `RadiusForm.tsx`** com os seguintes campos:

| Campo | Obrigatório | Detalhe |
|---|---|---|
| Localização central | ✅ Sim | Input com autocomplete OU botão "Usar minha localização" (geolocation API) |
| Raio de busca (km) | ✅ Sim | Slider de 1 a 50 km com valor exibido em tempo real |
| Tipo de combustível | ✅ Sim | Select: Gasolina / Etanol / Diesel / GNV |

**Comportamento:**
1. Ao mover o slider ou confirmar localização, mapa atualiza em tempo real um círculo visual representando o raio
2. Ao clicar "Buscar Postos":
   - API `GET /api/stations/nearby?lat=X&lng=Y&radius=Z&fuelType=T`
   - Query PostGIS: `ST_DWithin(location, ST_MakePoint($lng, $lat)::geography, $radiusMeters)`
3. Resultados ordenados por preço (mais barato no topo)
4. Mapa exibe marcadores coloridos dentro do círculo
5. Lista lateral com ranking dos postos: posição, nome, distância em km do centro, preço

---

## FLUXO 3 — Contribuição do Motorista (Crowdsourcing)

Este fluxo permite que qualquer motorista, **sem login**, contribua com dados da comunidade de duas formas: reportar o preço de um posto já cadastrado ou sugerir um novo posto que ainda não existe no sistema.

### Ponto de entrada
- Botão flutuante **"⛽ Reportar Posto"** visível no mapa em todos os fluxos, fixo no canto inferior esquerdo
- Também acessível via `/report`

### Sub-fluxo A — Reportar preço de posto existente

O motorista clica num marcador de posto no mapa e vê o botão **"Atualizar preço que vi aqui"** no popup. Isso abre um modal/drawer com:

| Campo | Obrigatório | Detalhe |
|---|---|---|
| Tipo de combustível | ✅ Sim | Select: Gasolina / Etanol / Diesel / GNV |
| Preço que você viu (R$) | ✅ Sim | Input numérico com máscara R$ X,XXX |
| Sua localização atual | ✅ Sim | Capturada automaticamente via `navigator.geolocation` com confirmação do usuário. Exibe "Você está a X metros deste posto" para validação de proximidade |

**Validação anti-spam:**
- O motorista deve estar a **no máximo 500 metros** do posto para reportar (verificado via distância geoespacial entre `reporterLat/Lng` e o posto)
- Se estiver mais longe, exibir aviso: *"Você parece estar longe deste posto. Tem certeza que está lá agora?"* com botão de confirmação forçada
- Hash do IP + user-agent salvo para limitar a 3 reports por posto por dia por dispositivo

### Sub-fluxo B — Sugerir novo posto

Ativado pelo botão "Reportar Posto" quando o motorista quer cadastrar um posto que não existe no mapa. Formulário em `/report`:

| Campo | Obrigatório | Detalhe |
|---|---|---|
| Nome do posto | ✅ Sim | Ex: "Posto Ipiranga Centro" |
| Localização do posto | ✅ Sim | **Duas opções**: (1) clicar no mapa para fixar o pin OU (2) autocomplete de endereço. O pin é arrastável para ajuste fino |
| Endereço completo | ✅ Sim | Preenchido automaticamente via geocodificação reversa ao fixar o pin, editável |
| Bandeira/rede | ❌ Opcional | Select: Petrobras, Shell, Ipiranga, Raizen, Branca, Outro |
| Tipo de combustível | ✅ Sim (ao menos 1) | Checkboxes múltiplos com campo de preço por tipo |
| Preço(s) observado(s) | ✅ Sim (ao menos 1) | Input por combustível marcado |
| Sua localização atual | ✅ Sim | Capturada via `navigator.geolocation` — salva como `reporterLat/Lng` |

**Comportamento ao salvar:**
- Cria registro em `Station` com `source: DRIVER`, `isVerified: false`
- Cria registros em `DriverPriceReport` (NÃO em `FuelPrice` — essa tabela é só para donos)
- O posto aparece **imediatamente** no mapa com um ícone diferenciado (pin cinza/tracejado = "não verificado")
- Tooltip no pin: *"Posto reportado pela comunidade — dados não verificados oficialmente"*

### Exibição de preços no `StationCard.tsx`

Cada card de posto deve exibir **as duas fontes de preço separadamente** com design visual distinto:

```
┌─────────────────────────────────────────────────────┐
│ 🟢 Posto Shell — Av. Paulista, 1234                 │
│                                                     │
│  GASOLINA COMUM                                     │
│  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ 🏪 DONO DO POSTO│  │ 👥 MOTORISTAS            │  │
│  │   R$ 5,89       │  │   R$ 5,75               │  │
│  │ atualizado há   │  │ último report há         │  │
│  │ 2 horas         │  │ 35 minutos               │  │
│  └─────────────────┘  └─────────────────────────┘  │
│                                                     │
│  [Ver todos os preços]  [Atualizar preço que vi]    │
└─────────────────────────────────────────────────────┘
```

Regras de exibição:
- Preço do **dono**: vem de `FuelPrice`, mostrado em azul/verde com ícone 🏪
- Preço dos **motoristas**: vem do `DriverPriceReport` mais recente para aquele combustível, mostrado em âmbar/laranja com ícone 👥
- Se não houver preço do dono: exibe apenas o de motoristas com aviso "Preço não confirmado pelo posto"
- Se não houver report de motoristas: exibe apenas o do dono
- Se ambos existirem e divergirem em mais de R$ 0,10: exibe badge ⚠️ "Preços divergentes — confirme no local"
- Ao expandir o card: mostra histórico dos últimos 5 reports de motoristas com horário (sem identificar quem reportou)

### APIs de Contribuição

#### `POST /api/driver-reports`
```typescript
// Body: { stationId, fuelType, price, reporterLat, reporterLng }
// Sem autenticação — anônimo
// Valida: distância do reporter ao posto (aviso se > 500m)
// Salva hash do IP para anti-spam
// Retorna: { success: true, distanceMeters: number, warning?: string }
```

#### `POST /api/stations/report`
```typescript
// Body: { name, address, lat, lng, brand, reporterLat, reporterLng, prices: [{fuelType, price}] }
// Sem autenticação — anônimo
// Verifica se já existe posto cadastrado a menos de 100m (evita duplicatas)
// Se duplicata encontrada: retorna o posto existente e sugere usar o report de preço
// Cria Station (source: DRIVER, isVerified: false) + DriverPriceReport(s)
// Retorna: { stationId, created: boolean, duplicate?: Station }
```

#### `GET /api/stations/[id]/reports`
```typescript
// Retorna os últimos 10 DriverPriceReports de um posto
// Agrupados por fuelType, ordenados por reportedAt DESC
// Não expõe IP ou device — apenas preço, distância e horário
```

---

## MÓDULO DO DONO DE POSTO

### Autenticação (`/owner/login`)
- Formulário de email + senha
- NextAuth.js Credentials Provider com bcrypt para verificar senha
- Sessão JWT com `role: "owner"` e `stationOwnerId`
- Middleware protege todas as rotas `/owner/dashboard/**`
- Link visível no rodapé da página principal: "Sou dono de posto →"

### Dashboard (`/owner/dashboard`)
- Lista os postos cadastrados do dono logado
- Badge colorido por posto indicando há quanto tempo os preços foram atualizados:
  - 🟢 Verde: atualizado há menos de 24h
  - 🟡 Amarelo: atualizado entre 24h e 72h
  - 🔴 Vermelho: desatualizado há mais de 72h
- Botão "Cadastrar novo posto"
- Botão "Atualizar preços" em cada posto

### Cadastro de Posto (`/owner/dashboard/station/new`)
Campos:
- Nome fantasia do posto (obrigatório)
- CNPJ (obrigatório, com validação de formato)
- Endereço completo (obrigatório, com autocomplete + geocodificação automática para obter lat/lng)
- Bandeira/rede (opcional: Petrobras, Shell, Ipiranga, Raizen, Branca, Outro)
- Telefone de contato (opcional)
- Preços iniciais por tipo de combustível (ao menos um obrigatório)

### Atualização de Preços (`/owner/dashboard/station/[id]`)
- Formulário com os 4 tipos de combustível
- Campos numéricos com máscara R$ X,XXX
- Checkbox "Este posto não vende este combustível" para desativar campos
- Timestamp da última atualização visível por campo
- Botão "Salvar preços" com feedback visual de sucesso

---

## APIS (Rotas Next.js)

### `GET /api/stations/nearby`
```typescript
// Query params: lat, lng, radius (km), fuelType
// Retorna: estações com AMBAS as fontes de preço (dono + último report de motorista)
const stations = await prisma.$queryRaw`
  SELECT
    s.*,
    -- Preço oficial do dono
    fp.price          AS owner_price,
    fp."updatedAt"    AS owner_price_updated_at,
    -- Último preço reportado por motorista
    dr.price          AS driver_price,
    dr."reportedAt"   AS driver_price_reported_at,
    -- Distância
    ST_Distance(
      s.location::geography,
      ST_MakePoint(${lng}, ${lat})::geography
    ) / 1000 AS distance_km
  FROM "Station" s
  LEFT JOIN "FuelPrice" fp
    ON fp."stationId" = s.id AND fp."fuelType" = ${fuelType}::"FuelType"
  LEFT JOIN LATERAL (
    SELECT price, "reportedAt"
    FROM "DriverPriceReport"
    WHERE "stationId" = s.id AND "fuelType" = ${fuelType}::"FuelType"
    ORDER BY "reportedAt" DESC
    LIMIT 1
  ) dr ON true
  WHERE
    (fp.price IS NOT NULL OR dr.price IS NOT NULL)
    AND ST_DWithin(
      s.location::geography,
      ST_MakePoint(${lng}, ${lat})::geography,
      ${radius * 1000}
    )
  ORDER BY COALESCE(fp.price, dr.price) ASC
`
```

### `POST /api/stations/along-route`
```typescript
// Body: { polylineCoordinates: [lng, lat][], fuelType, corridorKm }
// Para cada segmento da polyline, busca postos no corredor usando ST_DWithin
// Deduplica postos repetidos
// Retorna postos ordenados por preço
```

### `POST /api/stations` (autenticado)
```typescript
// Cria novo posto + geocodifica endereço automaticamente
// Salva lat/lng + atualiza campo location (PostGIS)
```

### `PUT /api/prices/[stationId]` (autenticado)
```typescript
// Upsert de preços por tipo de combustível
// Atualiza updatedAt automaticamente
```

---

## INTERFACE — REQUISITOS DE UX

### Página Principal (Motorista)
- Header simples com logo FuelRoute + link "Sou dono de posto" no canto direito
- Dois botões de seleção de fluxo grandes e claros, com ícones, **Fluxo 1 ativo por padrão**
- Formulário dinâmico abaixo dos botões (muda conforme fluxo selecionado)
- Mapa ocupa a maior parte da tela (mínimo 60vh)
- Painel lateral de resultados deslizável (drawer no mobile, sidebar no desktop)
- Marcadores no mapa com popup ao clicar mostrando preços e nome do posto
- Badge "Desatualizado" em postos com preços com mais de 72h sem atualizar

### Mobile First
- Layout responsivo
- Drawer de resultados swipeable no mobile
- Slider de raio com toque fácil (thumb grande)
- Botão flutuante "Usar minha localização" no mapa

### Estados de UI necessários
- Loading skeleton enquanto busca postos
- Estado vazio: "Nenhum posto encontrado nessa área"
- Estado de erro: "Erro ao buscar rota, tente novamente"
- Toast de sucesso ao salvar preços no dashboard

---

## VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
MAPBOX_ACCESS_TOKEN=pk.eyJ1...
# OU
NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIza...
```

---

## CONFIGURAÇÃO INICIAL (passo a passo para o gerador)

1. Criar projeto: `npx create-next-app@latest fuelroute --typescript --tailwind --app`
2. Instalar dependências:
   ```bash
   npm install prisma @prisma/client next-auth bcryptjs zod
   npm install @mapbox/mapbox-gl-directions mapbox-gl
   npm install -D @types/bcryptjs
   npx shadcn-ui@latest init
   npx shadcn-ui@latest add button input select slider card badge toast drawer dialog
   ```
3. `npx prisma init`
4. Criar schema conforme modelagem acima
5. `npx prisma migrate dev --name init`
6. Rodar SQL para adicionar coluna PostGIS (conforme seção do banco)
7. Criar seed com alguns postos de exemplo para desenvolvimento

---

## REGRAS DE NEGÓCIO IMPORTANTES

- Motorista **nunca** precisa de login para nenhuma funcionalidade, incluindo reportar preços e sugerir postos
- Apenas donos de posto logados podem inserir dados na tabela `FuelPrice` (preço oficial)
- Motoristas inserem dados apenas em `DriverPriceReport` e, ao sugerir novo posto, em `Station` com `source: DRIVER`
- Um dono pode ter múltiplos postos
- Preços exibem sempre a data/hora da última atualização, **por fonte** (dono e motoristas separadamente)
- Postos sem nenhum preço cadastrado (nem oficial nem de motorista) para o combustível selecionado **não aparecem** nos resultados
- O campo "litros no tanque" no Fluxo 1 é completamente opcional
- No Fluxo 2, o slider de raio deve atualizar o círculo no mapa em tempo real via `debounce` de 300ms
- Postos com `isVerified: false` (cadastrados por motoristas) aparecem no mapa com ícone diferente (pin tracejado/cinza) e tooltip de aviso
- A ordenação de preço usa `COALESCE(owner_price, driver_price)` — prioriza o oficial, mas usa o de motorista se não houver oficial
- Quando os preços do dono e dos motoristas divergem em mais de R$ 0,10, exibir badge de alerta no card
- IP e device são salvos **apenas como hash irreversível** (SHA-256) para anti-spam, nunca o valor original

---

## SEED DE DESENVOLVIMENTO (prisma/seed.ts)

Criar seed que popula:
- 2 donos de posto (com hashes bcrypt pré-definidos)
- 5 postos verificados em São Paulo (com lat/lng reais) com `source: OWNER, isVerified: true`
- 2 postos não verificados sugeridos por motoristas com `source: DRIVER, isVerified: false`
- Preços oficiais (`FuelPrice`) variados para gasolina e etanol nos postos verificados
- Reports de motoristas (`DriverPriceReport`) com timestamps variados nos postos verificados e nos não verificados
- Alguns reports com preços divergentes dos oficiais para testar o badge de alerta
