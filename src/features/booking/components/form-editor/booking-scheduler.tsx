import { useMemo } from 'react'
import { Calendar } from '@/ui/calendar'
import { Button } from '@/ui/button'
import { ArrowLeft } from 'lucide-react'
import { format, isSameDay } from 'date-fns'
import { cn } from '@/taali/lib/utils'
import { TimeSlotPicker } from './time-slot-picker'

// Re-export types for compatibility with BookingFlow
export type TimeRange = {
    start: string; // Format: "HH:MM" in 24h format
    end: string; // Format: "HH:MM" in 24h format
}

export type AvailabilityRule = {
    days: number[]; // 0-6 for days of the week (0 = Sunday)
    timeRanges: TimeRange[]
}

export type BlockedTime = {
    date: Date;
    timeRanges: TimeRange[]
}

export interface BookingSchedulerProps {
    // Availability configuration
    availableTimeRanges?: TimeRange[]
    availabilityRules?: AvailabilityRule[]
    blockedTimes?: BlockedTime[]
    unavailableDates?: Date[]
    timezone: string
    
    // Service configuration  
    duration: number // in minutes
    bufferTime?: number // in minutes
    interval?: number // booking interval in minutes
    
    // State management
    selectedDate: Date | null
    selectedTime: string | null
    onDateSelect: (date: Date | null) => void
    onTimeSelect: (time: string | null) => void
    onBack?: () => void
    
    // UI customization
    className?: string
    disabled?: boolean
}

export function BookingScheduler({
    availableTimeRanges = [],
    availabilityRules = [],
    blockedTimes = [],
    unavailableDates = [],
    timezone,
    duration,
    bufferTime = 0,
    interval = 30,
    selectedDate,
    selectedTime,
    onDateSelect,
    onTimeSelect,
    onBack,
    className,
    disabled = false
}: BookingSchedulerProps) {
    // Generate available time slots for the selected date
    const availableSlots = useMemo(() => {
        if (!selectedDate) return []
        
        const dayOfWeek = selectedDate.getDay()
        
        // Check if this date is blocked
        const isDateUnavailable = unavailableDates.some(date => 
            isSameDay(date, selectedDate)
        )
        
        if (isDateUnavailable) return []
        
        // Get availability rules for this day of the week
        const dayRules = availabilityRules.filter(rule => 
            rule.days.includes(dayOfWeek)
        )
        
        // Use either day-specific rules or general time ranges
        const timeRanges = dayRules.length > 0 
            ? dayRules.flatMap(rule => rule.timeRanges)
            : availableTimeRanges
        
        // Generate time slots
        const slots: string[] = []
        
        timeRanges.forEach(range => {
            const [startHour, startMin] = range.start.split(':').map(Number)
            const [endHour, endMin] = range.end.split(':').map(Number)
            
            const startMinutes = startHour * 60 + startMin
            const endMinutes = endHour * 60 + endMin
            
            // Generate slots at the specified interval
            for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += interval) {
                const hours = Math.floor(minutes / 60)
                const mins = minutes % 60
                
                const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
                
                // Check if this time is blocked
                const isBlocked = blockedTimes.some(blocked => 
                    isSameDay(blocked.date, selectedDate) &&
                    blocked.timeRanges.some(range => {
                        const [blockedStartHour, blockedStartMin] = range.start.split(':').map(Number)
                        const [blockedEndHour, blockedEndMin] = range.end.split(':').map(Number)
                        const blockedStart = blockedStartHour * 60 + blockedStartMin
                        const blockedEnd = blockedEndHour * 60 + blockedEndMin
                        
                        return minutes >= blockedStart && minutes < blockedEnd
                    })
                )
                
                if (!isBlocked) {
                    slots.push(timeStr)
                }
            }
        })
        
        return slots.sort()
    }, [selectedDate, availabilityRules, availableTimeRanges, blockedTimes, unavailableDates, duration, interval])

    // Check if a date should be disabled
    const isDateDisabled = (date: Date) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // Disable past dates
        if (date < today) return true
        
        // Check if date is in unavailable dates
        return unavailableDates.some(unavailableDate => 
            isSameDay(unavailableDate, date)
        )
    }

    return (
        <div className={cn("space-y-6", className)}>
            {/* Header with back button */}
            {onBack && (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        disabled={disabled}
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back
                    </Button>
                </div>
            )}
            
            {/* Calendar for date selection */}
            <div className="space-y-3">
                <h3 className="font-medium">Select a date</h3>
                <Calendar
                    mode="single"
                    selected={selectedDate || undefined}
                    onSelect={(date) => {
                        onDateSelect(date || null)
                        // Reset time selection when date changes
                        if (selectedTime) {
                            onTimeSelect(null)
                        }
                    }}
                    disabled={isDateDisabled}
                    className="rounded-md border"
                    initialFocus={false}
                />
            </div>
            
            {/* Time slot picker */}
            {selectedDate && (
                <div className="space-y-3">
                    <h3 className="font-medium">
                        Select a time for {format(selectedDate, 'PPPP')}
                    </h3>
                    <TimeSlotPicker
                        availableSlots={availableSlots}
                        selectedSlot={selectedTime}
                        onSelectSlot={onTimeSelect}
                        duration={duration}
                        disabled={disabled}
                    />
                </div>
            )}
        </div>
    )
}