import { format, formatDistance, formatRelative, parseISO } from 'date-fns'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'

/**
 * Get the user's timezone from the browser
 * Falls back to UTC if not available
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

/**
 * Convert a UTC date to the user's local timezone
 */
export function toUserTimezone(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  return toZonedTime(utcDate, userTimezone)
}

/**
 * Convert a local date to UTC for storage
 */
export function toUTC(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  
  const localDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  return fromZonedTime(localDate, userTimezone)
}

/**
 * Format a date in the user's timezone
 * @param date - The date to format (assumed to be in UTC)
 * @param formatString - Optional format string (defaults to 'MMM d, yyyy')
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatString: string = 'MMM d, yyyy'
): string {
  if (!date) return '-'
  
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  return formatInTimeZone(utcDate, userTimezone, formatString)
}

/**
 * Format a date and time in the user's timezone
 * @param date - The date to format (assumed to be in UTC)
 * @param formatString - Optional format string (defaults to 'MMM d, yyyy h:mm a')
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  formatString: string = 'MMM d, yyyy h:mm a'
): string {
  if (!date) return '-'
  
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  return formatInTimeZone(utcDate, userTimezone, formatString)
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 * @param date - The date to format (assumed to be in UTC)
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userDate = toUserTimezone(utcDate)
  if (!userDate) return '-'
  
  return formatDistance(userDate, new Date(), { addSuffix: true })
}

/**
 * Format a date relative to today (e.g., "yesterday", "last Monday")
 * @param date - The date to format (assumed to be in UTC)
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userDate = toUserTimezone(utcDate)
  if (!userDate) return '-'
  
  return formatRelative(userDate, new Date())
}

/**
 * Format a time only in the user's timezone
 * @param date - The date to format (assumed to be in UTC)
 * @param formatString - Optional format string (defaults to 'h:mm a')
 */
export function formatTime(
  date: Date | string | null | undefined,
  formatString: string = 'h:mm a'
): string {
  if (!date) return '-'
  
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  return formatInTimeZone(utcDate, userTimezone, formatString)
}

/**
 * Get a display string showing both local time and timezone
 * Useful for showing timezone context to users
 */
export function formatDateTimeWithTimezone(
  date: Date | string | null | undefined
): string {
  if (!date) return '-'
  
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  const formatted = formatInTimeZone(utcDate, userTimezone, 'MMM d, yyyy h:mm a zzz')
  return formatted
}