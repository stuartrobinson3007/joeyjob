import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { LANGUAGES, type Language } from '../constants'

import { authClient } from '@/lib/auth/auth-client'
import { useSession } from '@/lib/auth/auth-hooks'

export function useLanguage() {
  const { i18n } = useTranslation()
  const { data: session } = useSession()

  // Sync user's stored language with i18n and localStorage on session init
  useEffect(() => {
    if (session?.user?.language && i18n.isInitialized) {
      const userLanguage = session.user.language as Language
      const currentLanguage = i18n.language as Language
      const storedLanguage = localStorage.getItem('i18nextLng')

      console.log('Language sync check:', {
        userLanguage,
        currentLanguage,
        storedLanguage,
        isInitialized: i18n.isInitialized,
      })

      // If user's preferred language differs from current i18n language, sync it
      if (userLanguage !== currentLanguage) {
        console.log(`Syncing language from ${currentLanguage} to ${userLanguage}`)
        i18n.changeLanguage(userLanguage)
        localStorage.setItem('i18nextLng', userLanguage)
      }
    }
  }, [session?.user?.language, i18n, i18n.isInitialized])

  const changeLanguage = useCallback(
    async (language: Language) => {
      try {
        await i18n.changeLanguage(language)
        // Store preference in localStorage
        localStorage.setItem('i18nextLng', language)

        // Update user profile if logged in
        if (session?.user) {
          try {
            await authClient.updateUser({
              language: language,
            })
          } catch (error) {
            console.error('Failed to update user language preference:', error)
            // Continue even if user profile update fails - localStorage will work
          }
        }
      } catch (error) {
        console.error('Failed to change language:', error)
      }
    },
    [i18n, session?.user]
  )

  const getCurrentLanguage = useCallback((): Language => {
    return (i18n.language as Language) || 'en'
  }, [i18n.language])

  const getLanguageInfo = useCallback(
    (lang?: Language) => {
      const currentLang = lang || getCurrentLanguage()
      return LANGUAGES[currentLang]
    },
    [getCurrentLanguage]
  )

  return {
    language: getCurrentLanguage(),
    languages: LANGUAGES,
    changeLanguage,
    getLanguageInfo,
    isReady: i18n.isInitialized,
  }
}
