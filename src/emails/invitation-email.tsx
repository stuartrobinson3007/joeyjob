import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Link,
  Tailwind,
} from '@react-email/components'

import { safeNestedAccess, safeStringReplace } from '@/lib/utils/type-safe-access'

interface InvitationEmailProps {
  inviterName: string
  organizationName: string
  url: string
  language?: string
  appName?: string
}

// Fallback content for preview mode
const fallbackContent = {
  preview: 'Invitation to join {{organizationName}}',
  workspaceInvitation: 'Workspace Invitation',
  welcome: 'Welcome to {{organizationName}}',
  greeting: 'Hi there,',
  message: '{{inviterName}} has invited you to join {{organizationName}} on Todo App.',
  description:
    "You'll be joining a collaborative workspace where teams create, share, and manage projects together.",
  acceptButton: 'Accept Invitation',
  accessTitle: "What you'll get access to:",
  access: {
    collaborate: '• Collaborate with {{inviterName}} and the team',
    projects: '• Access to workspace projects and resources',
    communication: '• Real-time communication and file sharing',
  },
  expiry: 'This invitation expires in 48 hours.',
  orCopy: "If the button doesn't work, copy and paste this link:",
  questions:
    'Questions about this invitation? Reply to this email or contact {{inviterName}} directly.',
  footer: "If you weren't expecting this invitation, you can safely ignore this email.",
  copyright: '© {{year}} {{appName}}. All rights reserved.',
}

function getTranslation(key: string, params?: Record<string, unknown>): string {
  try {
    // Try to import and use i18n
    const i18n = require('@/i18n/config').default
    return i18n.t(`email:invitation.${key}`, params, { lng: 'en' })
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

export default function InvitationEmail({
  inviterName,
  organizationName,
  url,
  appName = 'Todo App',
}: InvitationEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>{getTranslation('preview', { organizationName })}</Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] px-[32px] py-[40px] max-w-[600px] mx-auto">
            {/* Header */}
            <Section className="text-center mb-[32px]">
              <Text className="text-[14px] text-green-600 font-semibold m-0 mb-[8px] uppercase tracking-wide">
                {getTranslation('workspaceInvitation')}
              </Text>
              <Heading className="text-[32px] font-bold text-gray-900 m-0">
                {getTranslation('welcome', { organizationName })}
              </Heading>
            </Section>

            {/* Personal Invitation */}
            <Section className="mb-[32px]">
              <Text className="text-[18px] text-gray-700 mb-[16px] leading-[26px]">
                {getTranslation('greeting')}
              </Text>

              <Text className="text-[16px] text-gray-700 mb-[20px] leading-[24px]">
                {getTranslation('message', { inviterName, organizationName })}
              </Text>

              <Text className="text-[16px] text-gray-700 mb-[24px] leading-[24px]">
                {getTranslation('description')}
              </Text>

              {/* Primary CTA */}
              <Section className="text-center mb-[32px]">
                <Button
                  href={url}
                  className="bg-green-600 text-white px-[40px] py-[16px] rounded-[8px] text-[16px] font-semibold no-underline box-border inline-block"
                >
                  {getTranslation('acceptButton')}
                </Button>
              </Section>

              {/* What to Expect */}
              <Section className="bg-green-50 rounded-[8px] p-[24px] mb-[24px]">
                <Heading className="text-[18px] font-bold text-gray-900 mb-[12px] m-0">
                  {getTranslation('accessTitle')}
                </Heading>
                <Text className="text-[14px] text-gray-700 m-0 mb-[8px]">
                  {getTranslation('access.collaborate', { inviterName })}
                </Text>
                <Text className="text-[14px] text-gray-700 m-0 mb-[8px]">
                  {getTranslation('access.projects')}
                </Text>
                <Text className="text-[14px] text-gray-700 m-0">
                  {getTranslation('access.communication')}
                </Text>
              </Section>

              {/* Urgency (Gentle) */}
              <Section className="bg-yellow-50 border-l-[4px] border-yellow-500 pl-[16px] py-[12px] mb-[24px]">
                <Text className="text-[14px] text-yellow-600 m-0">{getTranslation('expiry')}</Text>
              </Section>

              {/* Fallback Link */}
              <Text className="text-[14px] text-gray-600 mb-[12px]">
                {getTranslation('orCopy')}
              </Text>

              <Section className="bg-gray-50 rounded-[4px] p-[12px] mb-[24px]">
                <Link href={url} className="text-[14px] text-green-600 break-all">
                  {url}
                </Link>
              </Section>

              {/* Security Note */}
              <Text className="text-[14px] text-gray-600 leading-[20px]">
                {getTranslation('questions', { inviterName })} {getTranslation('footer')}
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

InvitationEmail.PreviewProps = {
  appName: 'Todo App',
  organizationName: "John's Workspace",
  inviterName: 'John Doe',
  url: 'https://app.example.com/invite/accept?token=abc123def456',
  language: 'en',
}
