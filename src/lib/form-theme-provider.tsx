import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'

import { extractFormTheme, applyFormTheme } from '@/lib/theme-utils'

type FormTheme = 'light' | 'dark'

interface FormThemeContextValue {
  theme: FormTheme
  primaryColor: string
  updateFormTheme: (theme: FormTheme, primaryColor: string) => void
}

const FormThemeContext = createContext<FormThemeContextValue | null>(null)

export function useFormTheme() {
  const context = useContext(FormThemeContext)
  if (!context) {
    throw new Error('useFormTheme must be used within a FormThemeProvider')
  }
  return context
}

interface FormThemeProviderProps {
  children: ReactNode
}

interface FormThemeState {
  theme: FormTheme
  primaryColor: string
}

export function FormThemeProvider({ children }: FormThemeProviderProps) {
  const router = useRouter()
  const [formTheme, setFormTheme] = useState<FormThemeState>({
    theme: 'light',
    primaryColor: '#3B82F6'
  })

  // Extract theme from current route's loader data
  useEffect(() => {
    try {
      // Get the current route's loader data
      const currentMatch = router.state.matches[router.state.matches.length - 1]
      if (currentMatch?.loaderData) {
        const extracted = extractFormTheme(currentMatch.loaderData)
        setFormTheme(extracted)
      }
    } catch (error) {
      console.warn('Unable to extract form theme from loader data:', error)
    }
  }, [router.state.matches])

  // Apply theme CSS when theme changes
  useEffect(() => {
    // Only run on client side
    if (typeof document === 'undefined') return

    const { themeCSS } = applyFormTheme(formTheme.theme, formTheme.primaryColor)

    // Remove existing form theme style
    const existingStyle = document.getElementById('form-theme-style')
    if (existingStyle) {
      existingStyle.remove()
    }

    // Add new form theme style
    const style = document.createElement('style')
    style.id = 'form-theme-style'
    style.textContent = themeCSS
    document.head.appendChild(style)

    return () => {
      const styleToRemove = document.getElementById('form-theme-style')
      if (styleToRemove) {
        styleToRemove.remove()
      }
    }
  }, [formTheme])

  const updateFormTheme = (theme: FormTheme, primaryColor: string) => {
    setFormTheme({ theme, primaryColor })
  }

  const contextValue: FormThemeContextValue = {
    theme: formTheme.theme,
    primaryColor: formTheme.primaryColor,
    updateFormTheme
  }

  return (
    <FormThemeContext.Provider value={contextValue}>
      <ThemeProvider
        attribute="class"
        defaultTheme={formTheme.theme}
        forcedTheme={formTheme.theme}
        enableSystem={false}
        disableTransitionOnChange
        value={{ light: "light", dark: "dark" }}
      >
        {children}
      </ThemeProvider>
    </FormThemeContext.Provider>
  )
}