import Link from 'next/link'
import { Fuel, ArrowLeft } from 'lucide-react'

export default function AuthShell({
  title,
  description,
  backHref = '/driver',
  backLabel = 'Voltar para busca',
  children,
}: {
  title: string
  description: string
  backHref?: string
  backLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.14),_transparent_45%),linear-gradient(180deg,#fffdfa_0%,#fff8f1_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center">
        <div className="w-full space-y-5">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#78716c] transition-colors hover:text-[#18181b]"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>

          <div className="rounded-[28px] border border-[#f3ddc9] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-[0_12px_28px_rgba(249,115,22,0.24)]">
                <Fuel className="size-5" />
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight text-[#18181b]">
                  Rotaposto
                </p>
                <p className="text-sm text-[#78716c]">Área de parceiros</p>
              </div>
            </div>

            <div className="mb-6 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[#18181b]">
                {title}
              </h1>
              <p className="text-sm leading-6 text-[#78716c]">{description}</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
