/**
 * Utility functions for formatting prices consistently throughout the application
 */

/**
 * Format a service price for display, handling both numeric and legacy string formats
 * @param price - The price value (number or legacy string like "$25.00")
 * @param currency - Currency code (default: "USD")
 * @param locale - Locale for formatting (default: "en-US")
 * @returns Formatted currency string (e.g., "$25.00")
 */
export function formatServicePrice(
  price: number | string | undefined | null,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  // Handle null/undefined
  if (price === null || price === undefined) {
    return '$0.00'
  }

  // Handle empty string
  if (price === '') {
    return '$0.00'
  }

  let numericPrice: number

  if (typeof price === 'string') {
    // Handle legacy formatted strings like "$25.00" or "$25"
    const cleanedPrice = price.replace(/[$,]/g, '')
    numericPrice = parseFloat(cleanedPrice)
    
    // If parsing failed, default to 0
    if (isNaN(numericPrice)) {
      numericPrice = 0
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