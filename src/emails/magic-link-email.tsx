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

interface MagicLinkEmailProps {
  url: string
  appName?: string
}

// Fallback content for preview mode
// Fallback content uses English by default
// For production, translations should be properly loaded
const fallbackContent = {
  title: 'Sign in to Todo App',
  heading: 'Sign in to Todo App',
  description: 'Click the button below to sign in to your account:',
  button: 'Sign in to Todo App',
  expiry: 'This link will expire in 5 minutes for security reasons.',
  alternative: "If the button doesn't work, copy and paste this link in your browser:",
  footer: "If you didn't request this email, you can safely ignore it.",
  copyright: '© {{year}} {{appName}}. All rights reserved.',
}

function getTranslation(key: string): string {
  try {
    // Try to import and use translations
    const emailTranslations = require('@/i18n/locales/en/email.json')
    return (
      emailTranslations.magicLink[key] ||
      fallbackContent[key as keyof typeof fallbackContent] ||
      key
    )
  } catch {
    // Fallback for preview mode
    return fallbackContent[key as keyof typeof fallbackContent] || key
  }
}

export default function MagicLinkEmail({ url, appName = 'Todo App' }: MagicLinkEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>{getTranslation('title')}</Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] px-[32px] py-[40px] max-w-[600px] mx-auto">
            {/* Header */}
            <Section className="text-center mb-[32px]">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-[8px]">
                {appName}
              </Heading>
            </Section>

            {/* Main Content */}
            <Section className="mb-[32px]">
              <Heading className="text-[24px] font-bold text-gray-900 mb-[16px] text-center">
                {getTranslation('heading')}
              </Heading>

              <Text className="text-[16px] text-gray-700 mb-[24px] leading-[24px]">
                {getTranslation('description')}
              </Text>

              {/* Primary CTA Button */}
              <Section className="text-center mb-[24px]">
                <Button
                  href={url}
                  className="bg-blue-600 text-white px-[32px] py-[16px] rounded-[8px] text-[16px] font-semibold no-underline box-border inline-block"
                >
                  {getTranslation('button')}
                </Button>
              </Section>

              {/* Security Message */}
              <Section className="bg-gray-50 rounded-[8px] p-[20px] mb-[24px]">
                <Text className="text-[14px] text-gray-600 m-0 text-center">
                  {getTranslation('expiry')}
                </Text>
              </Section>

              {/* Fallback Link */}
              <Text className="text-[14px] text-gray-600 mb-[16px]">
                {getTranslation('alternative')}
              </Text>

              <Section className="bg-gray-50 rounded-[4px] p-[12px] mb-[24px]">
                <Link href={url} className="text-[14px] text-blue-600 break-all">
                  {url}
                </Link>
              </Section>

              {/* Additional Security Info */}
              <Text className="text-[14px] text-gray-600 leading-[20px]">
                {getTranslation('footer')}
              </Text>
            </Section>

            {/* Footer */}
            <Section className="border-t border-gray-200 pt-[24px] text-center">
              <Text className="text-[12px] text-gray-500 m-0">
                {getTranslation('copyright')
                  .replace('{{year}}', new Date().getFullYear().toString())
                  .replace('{{appName}}', appName)}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

MagicLinkEmail.PreviewProps = {
  appName: 'Todo App',
  url: 'https://app.example.com/auth/verify?token=abc123def456ghi789',
}
