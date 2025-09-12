import { format, utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

/**
 * Convert a local date and time to UTC timestamp
 */
export function convertToUTC(date: string, time: string, timezone: string): Date {
  // Parse the date and time in the given timezone
  const localDateTime = `${date}T${time}:00`;
  const zonedDate = new Date(localDateTime);
  
  // Convert to UTC
  return zonedTimeToUtc(zonedDate, timezone);
}

/**
 * Format a UTC timestamp for display in a specific timezone
 */
export function formatBookingTime(utcDate: Date, timezone: string): {
  date: string;
  time: string;
  timeWithTz: string;
  timezone: string;
} {
  const zonedTime = utcToZonedTime(utcDate, timezone);
  
  return {
    date: format(zonedTime, 'MMM d, yyyy'),
    time: format(zonedTime, 'h:mm a'),
    timeWithTz: format(zonedTime, 'h:mm a zzz'),
    timezone: format(zonedTime, 'zzz')
  };
}

/**
 * Get timezone abbreviation (EST, PDT, etc.)
 */
export function getTimezoneAbbr(date: Date, timezone: string): string {
  const zonedTime = utcToZonedTime(date, timezone);
  return format(zonedTime, 'zzz');
}