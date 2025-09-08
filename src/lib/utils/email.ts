import { Resend } from 'resend'
import { ReactElement } from 'react'

import emailTranslations from '@/i18n/locales/en/email.json'
import MagicLinkEmail from '@/emails/magic-link-email'
import InvitationEmail from '@/emails/invitation-email'
import OTPEmail from '@/emails/otp-email'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendEmailOptions {
  to: string | string[]
  subject: string
  react: ReactElement
  from?: string
}

export async function sendEmail({
  to,
  subject,
  react,
  from = process.env.EMAIL_FROM!,
}: SendEmailOptions) {
  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      react,
    })

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

export async function sendMagicLinkEmail(email: string, url: string) {
  return sendEmail({
    to: email,
    subject: emailTranslations.magicLink.title,
    react: MagicLinkEmail({ url }),
  })
}

export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  organizationName: string,
  url: string
) {
  // Get subject from translations with fallback
  const getInvitationSubject = () => {
    try {
      return emailTranslations.invitation.subject
        .replace('{{inviterName}}', inviterName)
        .replace('{{organizationName}}', organizationName)
    } catch {
      // Fallback if translations fail
      return `${inviterName} invited you to join ${organizationName}`
    }
  }

  const result = await sendEmail({
    to: email,
    subject: getInvitationSubject(),
    react: InvitationEmail({ inviterName, organizationName, url }),
  })

  return result
}

export async function sendOTPEmail(
  email: string,
  otp: string,
  type: 'sign-in' | 'email-verification' | 'forget-password'
) {
  const getSubject = () => {
    // Use the email translations directly
    switch (type) {
      case 'sign-in':
        return emailTranslations.otp.signIn.subject
      case 'email-verification':
        return emailTranslations.otp.emailVerification.subject
      case 'forget-password':
        return emailTranslations.otp.forgetPassword.subject
      default:
        return emailTranslations.otp.default.subject
    }
  }

  return sendEmail({
    to: email,
    subject: getSubject(),
    react: OTPEmail({ otp, type }),
  })
}
