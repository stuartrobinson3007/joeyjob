/**
 * Utility functions for formatting prices consistently throughout the application
 */

/**
 * Format a service price for display, handling both numeric and legacy string formats
 * @param price - The price value (number or legacy string like "$25.00")
 * @param currency - Currency code (default: "USD")
 * @param locale - Locale for formatting (default: "en-US")
 * @param showDashForMissing - Whether to show "-" for missing prices instead of "$0.00" (default: false)
 * @returns Formatted currency string (e.g., "$25.00") or "-" for missing prices
 */
export function formatServicePrice(
  price: number | string | undefined | null,
  currency: string = 'USD',
  locale: string = 'en-US',
  showDashForMissing: boolean = false
): string {
  // Handle null/undefined
  if (price === null || price === undefined) {
    return showDashForMissing ? '-' : '$0.00'
  }

  // Handle empty string
  if (price === '') {
    return showDashForMissing ? '-' : '$0.00'
  }

  let numericPrice: number

  if (typeof price === 'string') {
    // Handle legacy formatted strings like "$25.00" or "$25"
    const cleanedPrice = price.replace(/[$,]/g, '')
    numericPrice = parseFloat(cleanedPrice)

    // If parsing failed, show dash or fallback
    if (isNaN(numericPrice)) {
      return showDashForMissing ? '-' : '$0.00'
    }
  } else {
    numericPrice = price
  }

  // Use Intl.NumberFormat for proper currency formatting
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericPrice)
}

/**
 * Parse a price input to a numeric value for database storage
 * @param priceInput - User input (string) or existing numeric value
 * @returns Numeric price value
 */
export function parseServicePrice(priceInput: string | number | undefined | null): number {
  if (priceInput === null || priceInput === undefined || priceInput === '') {
    return 0
  }

  if (typeof priceInput === 'number') {
    return priceInput
  }

  // Remove currency symbols and parse
  const cleanedPrice = priceInput.replace(/[$,]/g, '')
  const numericPrice = parseFloat(cleanedPrice)
  
  return isNaN(numericPrice) ? 0 : numericPrice
}