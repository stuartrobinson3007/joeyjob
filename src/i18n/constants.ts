export const LANGUAGES = {
  en: { code: 'en', name: 'English', flag: '🇺🇸' },
  es: { code: 'es', name: 'Español', flag: '🇪🇸' },
} as const

export const DEFAULT_LANGUAGE = 'en'

export const NAMESPACES = [
  'common',
  'auth',
  'todos',
  'team',
  'billing',
  'admin',
  'errors',
  'validation',
  'notifications',
  'profile',
  'settings',
  'invitations',
  'email',
] as const

export type Language = keyof typeof LANGUAGES
export type Namespace = (typeof NAMESPACES)[number]
