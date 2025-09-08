import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Section,
  Tailwind,
} from '@react-email/components'

import { safeNestedAccess, safeStringReplace } from '@/lib/utils/type-safe-access'

interface OTPEmailProps {
  otp: string
  type: 'sign-in' | 'email-verification' | 'forget-password'
  appName?: string
}

// Fallback content for preview mode
const fallbackContent = {
  verificationCode: 'Verification Code',
  greeting: 'Hi there,',
  support: 'If you have any questions or concerns, please contact our support team.',
  copyright: '© {{year}} {{appName}}. All rights reserved.',
  yourCode: 'Your Verification Code',
  instructions: {
    title: 'How to use this code:',
    step1: '1. Return to the {{appName}} sign-in page',
    step2: '2. Enter this 6-digit code in the verification field',
    step3: '3. Complete your sign-in process',
  },
  expiry: 'This code will expire in 5 minutes for security reasons.',
  footer: "If you didn't request this code, you can safely ignore this email.",
  signIn: {
    subject: 'Your sign-in code for Todo App',
    title: 'Sign in to Todo App',
    message: 'Use this code to sign in to your account:',
  },
  emailVerification: {
    subject: 'Verify your email for Todo App',
    title: 'Verify your email',
    message: 'Use this code to verify your email address:',
  },
  forgetPassword: {
    subject: 'Reset your password for Todo App',
    title: 'Reset your password',
    message: 'Use this code to reset your password:',
  },
  default: {
    subject: 'Your verification code for Todo App',
    title: 'Verification code',
    message: 'Your verification code is:',
  },
}

function getTranslation(key: string, params?: Record<string, unknown>): string {
  try {
    // Try to import and use i18n
    const i18n = require('@/i18n/config').default
    return i18n.t(`email:otp.${key}`, params, { lng: 'en' })
  } catch {
    // Fallback for preview mode using type-safe access
    let text = safeNestedAccess(fallbackContent, key.split('.')) || key

    if (typeof text === 'string' && params) {
      // Simple template replacement for fallback
      Object.entries(params).forEach(([paramKey, value]) => {
        text = safeStringReplace(text, new RegExp(`{{${paramKey}}}`, 'g'), String(value))
      })
    }

    return String(text)
  }
}

function getEmailContent(type: string) {
  switch (type) {
    case 'sign-in':
      return {
        subject: getTranslation('signIn.subject'),
        title: getTranslation('signIn.title'),
        message: getTranslation('signIn.message'),
        icon: '🔐',
        color: 'info',
      }
    case 'email-verification':
      return {
        subject: getTranslation('emailVerification.subject'),
        title: getTranslation('emailVerification.title'),
        message: getTranslation('emailVerification.message'),
        icon: '✉️',
        color: 'success',
      }
    case 'forget-password':
      return {
        subject: getTranslation('forgetPassword.subject'),
        title: getTranslation('forgetPassword.title'),
        message: getTranslation('forgetPassword.message'),
        icon: '🔑',
        color: 'warning',
      }
    default:
      return {
        subject: getTranslation('default.subject'),
        title: getTranslation('default.title'),
        message: getTranslation('default.message'),
        icon: '🔐',
        color: 'info',
      }
  }
}

export default function OTPEmail({ otp, type, appName = 'Todo App' }: OTPEmailProps) {
  const { title, message, icon, color } = getEmailContent(type)

  const colorClasses = {
    info: {
      header: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      code: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    success: {
      header: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      code: 'text-green-600 bg-green-50 border-green-200',
    },
    warning: {
      header: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      code: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    },
  }[color] || {
    header: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    code: 'text-blue-600 bg-blue-50 border-blue-200',
  }

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>{title}</Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] px-[32px] py-[40px] max-w-[600px] mx-auto">
            {/* Header */}
            <Section className="text-center mb-[32px]">
              <Text
                className={`text-[14px] ${colorClasses.header} font-semibold m-0 mb-[8px] uppercase tracking-wide`}
              >
                {getTranslation('verificationCode')}
              </Text>
              <Heading className="text-[32px] font-bold text-gray-900 m-0">
                {icon} {title}
              </Heading>
            </Section>

            {/* Main Content */}
            <Section className="mb-[32px]">
              <Text className="text-[18px] text-gray-700 mb-[16px] leading-[26px]">
                {getTranslation('greeting')}
              </Text>

              <Text className="text-[16px] text-gray-700 mb-[24px] leading-[24px]">{message}</Text>

              {/* OTP Code Display */}
              <Section
                className={`${colorClasses.bg} rounded-[12px] p-[32px] mb-[24px] text-center border-2 ${colorClasses.border}`}
              >
                <Text className="text-[14px] text-gray-600 m-0 mb-[12px] uppercase tracking-wide font-semibold">
                  {getTranslation('yourCode')}
                </Text>
                <Text
                  className={`text-[48px] font-bold ${colorClasses.code} font-mono tracking-[8px] m-0 p-[16px] rounded-[8px] border-2 inline-block`}
                >
                  {otp}
                </Text>
              </Section>

              {/* Instructions */}
              <Section className="bg-gray-50 rounded-[8px] p-[20px] mb-[24px]">
                <Heading className="text-[16px] font-bold text-gray-900 mb-[8px] m-0">
                  {getTranslation('instructions.title')}
                </Heading>
                <Text className="text-[14px] text-gray-700 m-0 mb-[4px]">
                  {getTranslation('instructions.step1', { appName })}
                </Text>
                <Text className="text-[14px] text-gray-700 m-0 mb-[4px]">
                  {getTranslation('instructions.step2')}
                </Text>
                <Text className="text-[14px] text-gray-700 m-0">
                  {getTranslation('instructions.step3')}
                </Text>
              </Section>

              {/* Expiry Warning */}
              <Section className="bg-yellow-50 border-l-[4px] border-yellow-500 pl-[16px] py-[12px] mb-[24px]">
                <Text className="text-[14px] text-yellow-600 m-0">{getTranslation('expiry')}</Text>
              </Section>

              {/* Security Note */}
              <Text className="text-[14px] text-gray-600 leading-[20px]">
                {getTranslation('footer')} {getTranslation('support')}
              </Text>
            </Section>

            {/* Footer */}
            <Section className="border-t border-gray-200 pt-[24px] text-center">
              <Text className="text-[12px] text-gray-500 m-0">
                {getTranslation('copyright', { year: new Date().getFullYear(), appName })}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

OTPEmail.PreviewProps = {
  appName: 'Todo App',
  otp: '123456',
  type: 'sign-in' as const,
  language: 'en',
}
