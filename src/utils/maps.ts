interface AddressData {
  street?: string
  street2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

/**
 * Format address as a single line for display
 */
export function formatAddressOneLine(address: AddressData | null): string {
  if (!address) return ''

  const parts: string[] = []

  // Add street address
  if (address.street) {
    let streetLine = address.street
    if (address.street2) {
      streetLine += `, ${address.street2}`
    }
    parts.push(streetLine)
  }

  // Add city, state, zip
  const cityStateParts: string[] = []
  if (address.city) cityStateParts.push(address.city)
  if (address.state) cityStateParts.push(address.state)
  if (cityStateParts.length > 0) {
    let cityState = cityStateParts.join(', ')
    if (address.zip) {
      cityState += ` ${address.zip}`
    }
    parts.push(cityState)
  } else if (address.zip) {
    parts.push(address.zip)
  }

  // Add country if provided
  if (address.country) {
    parts.push(address.country)
  }

  return parts.join(', ')
}

/**
 * Format address for display with line breaks
 */
export function formatAddressMultiLine(address: AddressData | null): string[] {
  if (!address) return []

  const lines: string[] = []

  // Street address
  if (address.street) {
    lines.push(address.street)
  }

  // Second address line
  if (address.street2) {
    lines.push(address.street2)
  }

  // City, state, zip
  const cityStateParts: string[] = []
  if (address.city) cityStateParts.push(address.city)
  if (address.state) cityStateParts.push(address.state)
  if (cityStateParts.length > 0) {
    let cityStateLine = cityStateParts.join(', ')
    if (address.zip) {
      cityStateLine += ` ${address.zip}`
    }
    lines.push(cityStateLine)
  } else if (address.zip) {
    lines.push(address.zip)
  }

  // Country (if provided)
  if (address.country) {
    lines.push(address.country)
  }

  return lines.filter(Boolean)
}

/**
 * Generate Google Maps link for an address
 */
export function getGoogleMapsLink(address: AddressData | null): string | null {
  if (!address) return null

  const addressString = formatAddressOneLine(address)
  if (!addressString) return null

  const encodedAddress = encodeURIComponent(addressString)
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`

}

/**
 * Generate Google Maps directions link
 */
export function getGoogleMapsDirectionsLink(address: AddressData | null): string | null {
  if (!address) return null

  const addressString = formatAddressOneLine(address)
  if (!addressString) return null

  const encodedAddress = encodeURIComponent(addressString)
  return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`
}

/**
 * Check if address has enough data to be useful
 */
export function hasValidAddress(address: AddressData | null): boolean {
  if (!address) return false

  // At minimum, we need either street or city
  return !!(address.street || address.city)
}

/**
 * Get appropriate maps link based on user preference
 */
export function getMapsLink(address: AddressData | null, type: 'view' | 'directions' = 'view'): string | null {
  if (type === 'directions') {
    return getGoogleMapsDirectionsLink(address)
  }
  return getGoogleMapsLink(address)
}