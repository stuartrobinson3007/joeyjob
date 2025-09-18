/**
 * Utilities for handling form themes and custom colors
 */

export type FormTheme = 'light' | 'dark'

/**
 * Generate CSS custom properties for form theming
 */
export function generateFormThemeCSS(primaryColor: string): string {
  // Convert hex to RGB for CSS custom properties
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
      : '59 130 246' // fallback to blue-500
  }

  const rgbColor = hexToRgb(primaryColor)

  return `
    :root {
      --primary: ${rgbColor};
      --primary-foreground: 255 255 255;
      --form-primary: ${primaryColor};
    }
  `
}

/**
 * Apply form theme to document
 */
export function applyFormTheme(theme: FormTheme, primaryColor: string): {
  htmlClassName: string
  themeCSS: string
} {
  return {
    htmlClassName: theme,
    themeCSS: generateFormThemeCSS(primaryColor)
  }
}

/**
 * Extract theme data from form loader data
 */
export function extractFormTheme(loaderData: any): {
  theme: FormTheme
  primaryColor: string
} {
  return {
    theme: (loaderData?.form?.theme as FormTheme) || 'light',
    primaryColor: loaderData?.form?.primaryColor || '#3B82F6'
  }
}