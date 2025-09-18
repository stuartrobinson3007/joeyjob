import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import { DEFAULT_LANGUAGE, NAMESPACES } from './constants'
// Import translation files
import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
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
import enBookings from './locales/en/bookings.json'
import enBooking from './locales/en/booking.json'
import enServices from './locales/en/services.json'
import enForms from './locales/en/forms.json'
import esCommon from './locales/es/common.json'
import esAuth from './locales/es/auth.json'
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
import esBookings from './locales/es/bookings.json'
import esBooking from './locales/es/booking.json'
import esServices from './locales/es/services.json'
import esForms from './locales/es/forms.json'

export const defaultNS = 'common'

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
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
    bookings: enBookings,
    booking: enBooking,
    services: enServices,
    forms: enForms,
  },
  es: {
    common: esCommon,
    auth: esAuth,
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
    bookings: esBookings,
    booking: esBooking,
    services: esServices,
    forms: esForms,
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
