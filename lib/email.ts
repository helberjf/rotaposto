import { Resend } from 'resend'

let resendClient: Resend | null = null

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    return null
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }

  return resendClient
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || 'Rotaposto <no-reply@rotaposto.com>'
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const resend = getResendClient()

  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY não configurada. Email não enviado para ${to}.`
    )
    return { skipped: true }
  }

  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject,
    html,
  })

  return { skipped: false }
}
