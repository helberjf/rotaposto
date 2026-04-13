'use client'

import Link from 'next/link'
import { Menu, ShieldCheck, UserRoundCog, CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const links = [
  {
    href: '/owner/login',
    icon: UserRoundCog,
    title: 'Login do dono',
    description: 'Entrar para cadastrar postos e atualizar preços.',
  },
  {
    href: '/owner/register',
    icon: CircleHelp,
    title: 'Criar conta',
    description: 'Cadastrar uma nova empresa parceira na plataforma.',
  },
  {
    href: '/owner/admin/login',
    icon: ShieldCheck,
    title: 'Login admin',
    description: 'Aprovar parceiros e revisar cadastros pendentes.',
  },
]

export default function AppAccessSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-full border-[#eaded3] bg-white text-[#18181b] shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
        >
          <Menu className="size-5" />
          <span className="sr-only">Abrir acessos</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="border-[#f3ddc9] bg-[#fffdfa]">
        <SheetHeader className="border-b border-[#f3ddc9] pb-4">
          <SheetTitle className="text-xl tracking-tight text-[#18181b]">
            Área de parceiros
          </SheetTitle>
          <SheetDescription className="text-sm leading-6 text-[#78716c]">
            Entre como dono de posto, crie uma conta nova ou acesse a área administrativa.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
          {links.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="rounded-[22px] border border-[#eaded3] bg-white px-4 py-4 transition-colors hover:border-[#f5c8a6] hover:bg-[#fff8f1]"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff4eb] text-[#f97316]">
                  <Icon className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold tracking-tight text-[#18181b]">
                    {title}
                  </p>
                  <p className="text-sm leading-5 text-[#78716c]">{description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
