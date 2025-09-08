import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import { DEFAULT_LANGUAGE, NAMESPACES } from './constants'
// Import translation files
import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enTodos from './locales/en/todos.json'
import enTeam from './locales/en/team.json'
import enBilling from './locales/en/billing.json'
import enAdmin from './locales/en/admin.json'
import enErrors from './locales/en/errors.json'
import enValidation from './locales/en/validation.json'
import enNotifications from './locales/en/notifications.json'
import enProfile from './locales/en/profile.json'
import enSettings from './locales/en/settings.json'
import enInvitations from './locales/en/invitations.json'
import enEmail from './locales/en/email.json'
import esCommon from './locales/es/common.json'
import esAuth from './locales/es/auth.json'
import esTodos from './locales/es/todos.json'
import esTeam from './locales/es/team.json'
import esBilling from './locales/es/billing.json'
import esAdmin from './locales/es/admin.json'
import esErrors from './locales/es/errors.json'
import esValidation from './locales/es/validation.json'
import esNotifications from './locales/es/notifications.json'
import esProfile from './locales/es/profile.json'
import esSettings from './locales/es/settings.json'
import esInvitations from './locales/es/invitations.json'
import esEmail from './locales/es/email.json'

export const defaultNS = 'common'

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    todos: enTodos,
    team: enTeam,
    billing: enBilling,
    admin: enAdmin,
    errors: enErrors,
    validation: enValidation,
    notifications: enNotifications,
    profile: enProfile,
    settings: enSettings,
    invitations: enInvitations,
    email: enEmail,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    todos: esTodos,
    team: esTeam,
    billing: esBilling,
    admin: esAdmin,
    errors: esErrors,
    validation: esValidation,
    notifications: esNotifications,
    profile: esProfile,
    settings: esSettings,
    invitations: esInvitations,
    email: esEmail,
  },
} as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: {
      'en-US': ['en'],
      'en-NZ': ['en'],
      'en-AU': ['en'],
      'en-GB': ['en'],
      'es-ES': ['es'],
      'es-MX': ['es'],
      'es-AR': ['es'],
      'default': [DEFAULT_LANGUAGE]
    },
    debug: false,

    ns: NAMESPACES,
    defaultNS,

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    react: {
      useSuspense: false, // Important for SSR
    },

    resources,
  })

export default i18n
