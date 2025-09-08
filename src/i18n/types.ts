import type { resources } from './config'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: (typeof resources)['en']
  }
}

export type TranslationFunction = (key: string, options?: Record<string, unknown>) => string
