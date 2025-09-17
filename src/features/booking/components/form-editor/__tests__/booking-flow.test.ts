import { describe, it, expect } from 'vitest'
import { findFirstAvailableDate } from '../booking-flow'

describe('findFirstAvailableDate', () => {
  it('should return first available date with slots', () => {
    const availabilityData = {
      '2024-01-15': ['10:00am', '2:00pm'],
      '2024-01-10': ['9:00am'],
      '2024-01-20': ['11:00am']
    }
    const result = findFirstAvailableDate(availabilityData)
    expect(result).toEqual(new Date('2024-01-10'))
  })

  it('should return null when no availability data', () => {
    expect(findFirstAvailableDate({})).toBeNull()
    expect(findFirstAvailableDate(null as any)).toBeNull()
    expect(findFirstAvailableDate(undefined as any)).toBeNull()
  })

  it('should ignore dates with empty slot arrays', () => {
    const availabilityData = {
      '2024-01-10': [], // No slots
      '2024-01-15': ['10:00am', '2:00pm'],
      '2024-01-12': [] // No slots
    }
    const result = findFirstAvailableDate(availabilityData)
    expect(result).toEqual(new Date('2024-01-15'))
  })

  it('should handle dates across different months and years', () => {
    const availabilityData = {
      '2024-12-25': ['10:00am'],
      '2024-11-30': ['9:00am'],
      '2025-01-01': ['11:00am']
    }
    const result = findFirstAvailableDate(availabilityData)
    expect(result).toEqual(new Date('2024-11-30'))
  })

  it('should return null when all dates have empty slots', () => {
    const availabilityData = {
      '2024-01-10': [],
      '2024-01-11': [],
      '2024-01-12': []
    }
    const result = findFirstAvailableDate(availabilityData)
    expect(result).toBeNull()
  })

  it('should correctly sort dates chronologically not alphabetically', () => {
    const availabilityData = {
      '2024-01-09': ['10:00am'], // This should be first chronologically
      '2024-01-10': ['9:00am'],
      '2024-01-02': ['11:00am']   // This would be first alphabetically
    }
    const result = findFirstAvailableDate(availabilityData)
    expect(result).toEqual(new Date('2024-01-02'))
  })

  it('should handle single available date', () => {
    const availabilityData = {
      '2024-01-15': ['10:00am', '2:00pm']
    }
    const result = findFirstAvailableDate(availabilityData)
    expect(result).toEqual(new Date('2024-01-15'))
  })

  it('should handle mixed availability patterns', () => {
    const availabilityData = {
      '2024-01-10': [],                    // No slots
      '2024-01-11': ['9:00am'],           // Has slots
      '2024-01-12': [],                    // No slots  
      '2024-01-13': ['10:00am', '2:00pm'], // Has slots
      '2024-01-14': []                     // No slots
    }
    const result = findFirstAvailableDate(availabilityData)
    expect(result).toEqual(new Date('2024-01-11'))
  })

  it('should handle dates with different formatting', () => {
    const availabilityData = {
      '2024-01-05': ['10:00am'], // Standard ISO format
      '2024-01-10': ['9:00am']
    }
    const result = findFirstAvailableDate(availabilityData)
    expect(result).toEqual(new Date('2024-01-05'))
  })

  it('should return the earliest date across multiple months', () => {
    const availabilityData = {
      '2024-02-01': ['10:00am'],
      '2024-01-31': ['9:00am'],
      '2024-03-01': ['11:00am']
    }
    const result = findFirstAvailableDate(availabilityData)
    expect(result).toEqual(new Date('2024-01-31'))
  })
})