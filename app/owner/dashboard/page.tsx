'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import {
  Building2,
  ClipboardList,
  Fuel,
  LogOut,
  MapPin,
  Plus,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react'
import StationForm from '@/components/owner/station-form'
import StationCard from '@/components/owner/station-card'

interface Station {
  id: string
  name: string
  cnpj?: string
  address: string
  lat: number
  lng: number
  brand?: string
  phone?: string
  fuel_prices?: Array<{
    fuelType: string
    price: number
    updatedAt: string
  }>
}

interface OwnerProfile {
  id: string
  name: string
  email: string
  cnpj?: string | null
  phone?: string | null
  status: string
  approvedAt?: string | null
  emailVerifiedAt?: string | null
}

interface Suggestion {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  brand?: string
  phone?: string
  status: string
  rejectionReason?: string
  createdAt: string
}

interface OwnerApproval {
  id: string
  name: string
  email: string
  cnpj?: string | null
  phone?: string | null
  status: string
  emailVerifiedAt?: string | null
  approvedAt?: string | null
  rejectionReason?: string | null
  createdAt: string
}

function DashboardPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdmin = session?.user.role === 'ADMIN'
  const [activeTab, setActiveTab] = useState('stations')

  const [stations, setStations] = useState<Station[]>([])
  const [profile, setProfile] = useState<OwnerProfile | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [ownerApprovals, setOwnerApprovals] = useState<OwnerApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [showNewStationForm, setShowNewStationForm] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const defaultTab = useMemo(() => {
    const requestedTab = searchParams.get('tab')
    if (requestedTab) {
      return requestedTab
    }

    return isAdmin ? 'owner-approvals' : 'stations'
  }, [isAdmin, searchParams])

  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/owner/login')
    }
  }, [router, status])

  const loadDashboard = useCallback(async () => {
    setLoading(true)

    try {
      if (isAdmin) {
        const [ownersResponse, suggestionsResponse] = await Promise.all([
          fetch('/api/admin/owner-approvals'),
          fetch('/api/owner/station-suggestions'),
        ])

        if (ownersResponse.ok) {
          setOwnerApprovals(await ownersResponse.json())
        }

        if (suggestionsResponse.ok) {
          setSuggestions(await suggestionsResponse.json())
        }
      } else {
        const [profileResponse, stationsResponse] = await Promise.all([
          fetch('/api/owner/profile'),
          fetch('/api/owner/stations'),
        ])

        if (profileResponse.ok) {
          setProfile(await profileResponse.json())
        }

        if (stationsResponse.ok) {
          setStations(await stationsResponse.json())
        }
      }
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (status === 'authenticated') {
      void loadDashboard()
    }
  }, [loadDashboard, status])

  async function handleStationCreated() {
    setShowNewStationForm(false)
    setSelectedStation(null)
    await loadDashboard()
  }

  async function handleStationUpdated() {
    setSelectedStation(null)
    await loadDashboard()
  }

  async function handleSuggestionAction(
    id: string,
    action: 'APPROVED' | 'REJECTED'
  ) {
    setProcessingId(id)

    try {
      const rejectionReason =
        action === 'REJECTED'
          ? window.prompt('Motivo da rejeição (opcional):') || undefined
          : undefined

      await fetch('/api/owner/station-suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, rejectionReason }),
      })
      await loadDashboard()
    } finally {
      setProcessingId(null)
    }
  }

  async function handleOwnerApproval(
    ownerId: string,
    action: 'APPROVE' | 'REJECT'
  ) {
    setProcessingId(ownerId)

    try {
      const rejectionReason =
        action === 'REJECT'
          ? window.prompt('Motivo da recusa (opcional):') || undefined
          : undefined

      await fetch('/api/admin/owner-approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId, action, rejectionReason }),
      })
      await loadDashboard()
    } finally {
      setProcessingId(null)
    }
  }

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fffdfa_0%,#fff8f1_100%)]">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffdfa_0%,#fff8f1_100%)]">
      <header className="sticky top-0 z-50 border-b border-[#f1e6da] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-[0_12px_28px_rgba(249,115,22,0.24)]">
              <Fuel className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[#18181b]">
                Rotaposto
              </h1>
              <p className="text-sm text-[#78716c]">
                {isAdmin ? 'Painel administrativo' : 'Painel do dono de posto'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-[#18181b]">{session.user.name}</p>
              <p className="text-xs text-[#78716c]">{session.user.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/driver' })}
              className="rounded-xl border-[#e7d6c7] bg-white"
            >
              <LogOut className="mr-2 size-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-2 rounded-2xl border border-[#f3ddc9] bg-white p-2">
            {!isAdmin && (
              <>
                <TabsTrigger value="stations" className="gap-2 rounded-xl">
                  <MapPin className="size-4" />
                  Postos
                </TabsTrigger>
                <TabsTrigger value="account" className="gap-2 rounded-xl">
                  <Building2 className="size-4" />
                  Cadastro
                </TabsTrigger>
              </>
            )}
            {isAdmin && (
              <>
                <TabsTrigger value="owner-approvals" className="gap-2 rounded-xl">
                  <UserCheck className="size-4" />
                  Donos de posto
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="gap-2 rounded-xl">
                  <ClipboardList className="size-4" />
                  Sugestões de postos
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {!isAdmin && (
            <>
              <TabsContent value="stations" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-[#18181b]">
                      Meus postos
                    </h2>
                    <p className="text-sm text-[#78716c]">
                      Cadastre novos postos e mantenha os preços oficiais atualizados.
                    </p>
                  </div>

                  {!showNewStationForm ? (
                    <Button
                      onClick={() => setShowNewStationForm(true)}
                      className="rounded-xl bg-[#f97316] text-white hover:bg-[#ea6a12]"
                    >
                      <Plus className="mr-2 size-4" />
                      Novo posto
                    </Button>
                  ) : null}
                </div>

                {showNewStationForm ? (
                  <Card className="rounded-[24px] border-[#f3ddc9] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                    <CardHeader>
                      <CardTitle>Adicionar novo posto</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <StationForm onSuccess={() => void handleStationCreated()} />
                    </CardContent>
                  </Card>
                ) : null}

                {selectedStation ? (
                  <Card className="rounded-[24px] border-[#f3ddc9] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                    <CardHeader>
                      <CardTitle>Editar posto</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <StationForm
                        station={selectedStation}
                        onSuccess={() => void handleStationUpdated()}
                      />
                    </CardContent>
                  </Card>
                ) : null}

                {stations.length === 0 ? (
                  <Card className="rounded-[24px] border-dashed border-[#f3ddc9] bg-white">
                    <CardContent className="py-10 text-center text-[#78716c]">
                      Nenhum posto cadastrado ainda. Comece adicionando o primeiro.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {stations.map((station) => (
                      <StationCard
                        key={station.id}
                        station={station}
                        onEdit={() => setSelectedStation(station)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="account" className="space-y-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[#18181b]">
                    Dados do parceiro
                  </h2>
                  <p className="text-sm text-[#78716c]">
                    Informações validadas para o acesso administrativo da empresa.
                  </p>
                </div>

                <Card className="rounded-[24px] border-[#f3ddc9] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                  <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                    <InfoBlock label="Responsável" value={profile?.name || session.user.name || '-'} />
                    <InfoBlock label="Email" value={profile?.email || session.user.email || '-'} />
                    <InfoBlock label="CNPJ" value={profile?.cnpj || '-'} />
                    <InfoBlock label="Telefone" value={profile?.phone || '-'} />
                    <InfoBlock label="Status da conta" value={translateOwnerStatus(profile?.status || session.user.status)} />
                    <InfoBlock
                      label="Aprovado em"
                      value={
                        profile?.approvedAt
                          ? formatDate(profile.approvedAt)
                          : 'Ainda sem data de aprovação'
                      }
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}

          {isAdmin && (
            <>
              <TabsContent value="owner-approvals" className="space-y-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[#18181b]">
                    Aprovação de parceiros
                  </h2>
                  <p className="text-sm text-[#78716c]">
                    Libere o acesso dos donos de posto depois da confirmação de email e da análise cadastral.
                  </p>
                </div>

                <div className="grid gap-4">
                  {ownerApprovals.map((owner) => (
                    <Card
                      key={owner.id}
                      className="rounded-[24px] border-[#f3ddc9] shadow-[0_16px_38px_rgba(15,23,42,0.05)]"
                    >
                      <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold tracking-tight text-[#18181b]">
                              {owner.name}
                            </p>
                            <StatusPill label={translateOwnerStatus(owner.status)} status={owner.status} />
                          </div>
                          <div className="grid gap-1 text-sm text-[#78716c]">
                            <p>Email: {owner.email}</p>
                            <p>CNPJ: {owner.cnpj || 'Não informado'}</p>
                            <p>Telefone: {owner.phone || 'Não informado'}</p>
                            <p>Email confirmado: {owner.emailVerifiedAt ? formatDate(owner.emailVerifiedAt) : 'Não'}</p>
                            <p>Solicitado em: {formatDate(owner.createdAt)}</p>
                            {owner.rejectionReason ? (
                              <p className="text-[#b91c1c]">Motivo: {owner.rejectionReason}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          {owner.status !== 'ACTIVE' ? (
                            <Button
                              size="sm"
                              disabled={processingId === owner.id}
                              onClick={() => void handleOwnerApproval(owner.id, 'APPROVE')}
                              className="rounded-xl bg-[#15803d] text-white hover:bg-[#166534]"
                            >
                              <ShieldCheck className="mr-2 size-4" />
                              Aprovar acesso
                            </Button>
                          ) : null}
                          {owner.status !== 'REJECTED' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processingId === owner.id}
                              onClick={() => void handleOwnerApproval(owner.id, 'REJECT')}
                              className="rounded-xl border-[#fecaca] text-[#b91c1c] hover:bg-[#fff1f2]"
                            >
                              <XCircle className="mr-2 size-4" />
                              Recusar
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="suggestions" className="space-y-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[#18181b]">
                    Sugestões de postos
                  </h2>
                  <p className="text-sm text-[#78716c]">
                    Revise os postos sugeridos pela comunidade e publique os válidos.
                  </p>
                </div>

                <div className="grid gap-4">
                  {suggestions.map((suggestion) => (
                    <Card
                      key={suggestion.id}
                      className="rounded-[24px] border-[#f3ddc9] shadow-[0_16px_38px_rgba(15,23,42,0.05)]"
                    >
                      <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold tracking-tight text-[#18181b]">
                              {suggestion.name}
                            </p>
                            <StatusPill
                              label={translateSuggestionStatus(suggestion.status)}
                              status={suggestion.status}
                            />
                          </div>
                          <div className="grid gap-1 text-sm text-[#78716c]">
                            <p>{suggestion.address}</p>
                            {suggestion.brand ? <p>Bandeira: {suggestion.brand}</p> : null}
                            {suggestion.phone ? <p>Telefone: {suggestion.phone}</p> : null}
                            <p>Recebido em: {formatDate(suggestion.createdAt)}</p>
                            {suggestion.rejectionReason ? (
                              <p className="text-[#b91c1c]">Motivo: {suggestion.rejectionReason}</p>
                            ) : null}
                          </div>
                        </div>

                        {suggestion.status === 'PENDING' ? (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={processingId === suggestion.id}
                              onClick={() => void handleSuggestionAction(suggestion.id, 'APPROVED')}
                              className="rounded-xl bg-[#15803d] text-white hover:bg-[#166534]"
                            >
                              Aprovar posto
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processingId === suggestion.id}
                              onClick={() => void handleSuggestionAction(suggestion.id, 'REJECTED')}
                              className="rounded-xl border-[#fecaca] text-[#b91c1c] hover:bg-[#fff1f2]"
                            >
                              Rejeitar
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fffdfa_0%,#fff8f1_100%)]">
          <Spinner className="size-8" />
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#f3ddc9] bg-[#fffdfa] px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#a8a29e]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-[#18181b]">{value}</p>
    </div>
  )
}

function StatusPill({ label, status }: { label: string; status: string }) {
  const className =
    status === 'ACTIVE' || status === 'APPROVED'
      ? 'bg-[#dcfce7] text-[#166534]'
      : status === 'PENDING_APPROVAL' || status === 'PENDING'
        ? 'bg-[#ffedd5] text-[#c2410c]'
        : 'bg-[#fee2e2] text-[#b91c1c]'

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

function translateOwnerStatus(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'Acesso ativo'
    case 'PENDING_APPROVAL':
      return 'Aguardando aprovação'
    case 'PENDING_EMAIL_VERIFICATION':
      return 'Aguardando confirmação de email'
    case 'REJECTED':
      return 'Cadastro recusado'
    case 'BLOCKED':
      return 'Conta bloqueada'
    default:
      return status
  }
}

function translateSuggestionStatus(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'Aprovado'
    case 'REJECTED':
      return 'Rejeitado'
    default:
      return 'Pendente'
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
