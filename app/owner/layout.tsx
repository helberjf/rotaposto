import AuthSessionProvider from '@/components/session-provider'

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthSessionProvider>{children}</AuthSessionProvider>
}
