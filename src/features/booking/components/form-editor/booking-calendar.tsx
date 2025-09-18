import { Calendar } from "../calendar";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/ui/button";
import { ScrollArea } from "@/ui/scroll-area";
import { Clock4, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/taali/lib/utils";
import { isSameDay, addDays } from 'date-fns';

// Day names mapping for display
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Month names for display
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

// Number of days to search forward for availability
const DAYS_TO_SEARCH = 60;

export type TimeRange = {
    start: string; // Format: "HH:MM" in 24h format
    end: string; // Format: "HH:MM" in 24h format
};

export type AvailabilityRule = {
    days: number[]; // 0-6 for days of the week (0 = Sunday)
    timeRanges: TimeRange[];
};

export type BlockedTime = {
    date: Date;
    timeRanges: TimeRange[];
};

// Employee interface for availability checking
export type Employee = {
    id: string;
    simproEmployeeId: number;
    name: string;
    email?: string;
    isDefault: boolean;
};

export type BookingCalendarProps = {
    // Availability can be defined in two ways:
    // 1. General time ranges that apply to all days
    availableTimeRanges?: TimeRange[];
    // 2. Specific rules for different days of the week
    availabilityRules?: AvailabilityRule[];
    // Blocked times override availability
    blockedTimes?: BlockedTime[];
    // Specific days that should be completely unavailable
    unavailableDates?: Date[];
    timezone: string;
    title: string;
    serviceName?: string; // Name of the service being booked
    duration: number; // in minutes
    bufferTime?: number; // in minutes, default 0
    interval?: number; // in minutes, default 30
    minimumNotice?: number; // Minimum notice value
    minimumNoticeUnit?: 'days' | 'hours'; // Unit for minimum notice
    dateRangeType?: 'rolling' | 'fixed' | 'indefinite'; // Type of date range restriction
    rollingDays?: number; // Number of days for rolling window
    rollingUnit?: 'calendar-days' | 'week-days'; // Type of days for rolling window
    fixedStartDate?: Date; // Start date for fixed range
    fixedEndDate?: Date; // End date for fixed range
    onSelectDateTime?: (date: Date, time: string) => void;
    onDateChange?: (date: Date | null) => void; // Callback when date selection changes
    onBackClicked?: () => void; // Callback when back button is clicked
    onMonthChange?: (date: Date) => void; // Callback when calendar month changes
    darkMode?: boolean;
    primaryColor?: string; // Primary color for selected elements
    // State from parent
    selectedDate?: Date | null;
    selectedTime?: string | null;
    isLoading?: boolean; // Loading state for availability fetching
    hasNoEmployees?: boolean; // No employees available for this service
    organizationName?: string;
    organizationPhone?: string;
    organizationEmail?: string;
    currentMonth?: number; // Current month being displayed (1-12)
    currentYear?: number; // Current year being displayed
    // Employee availability integration (simplified)
    availabilityData?: { [date: string]: string[] }; // Pre-calculated availability: date -> time slots
} & React.ComponentProps<"div">;

/**
 * Converts a time string in "HH:MM" format to minutes from midnight
 */
function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours * 60) + minutes;
}

/**
 * Formats minutes from midnight to "HH:MMam/pm" format in 12h
 */
function minutesToTime12h(minutes: number): string {
    let hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    return `${hours.toString()}:${mins.toString().padStart(2, '0')}${ampm}`;
}

/**
 * Checks if a time slot overlaps with any of the given time ranges
 */
function isOverlapping(
    slotStart: number,
    slotEnd: number,
    timeRanges: TimeRange[]
): boolean {
    return timeRanges.some(range => {
        const rangeStart = timeToMinutes(range.start);
        const rangeEnd = timeToMinutes(range.end);

        // Check if there's any overlap
        return (
            (slotStart >= rangeStart && slotStart < rangeEnd) || // Slot start is within range
            (slotEnd > rangeStart && slotEnd <= rangeEnd) || // Slot end is within range
            (slotStart <= rangeStart && slotEnd >= rangeEnd) // Slot completely contains range
        );
    });
}

/**
 * Get the day of week (0-6) for a Date
 */
function getDayOfWeek(date: Date): number {
    return date.getDay();
}

/**
 * Calculate a contrasting color (black or white) based on the background color
 */
function contrastingColor(hex: string, factorAlpha = false): string {
    // Handle case where regex doesn't match
    const matches = hex
        .replace(/^#?(?:(?:(..)(..)(..)(..)?)|(?:(.)(.)(.)(.)?))$/, '$1$5$5$2$6$6$3$7$7$4$8$8')
        .match(/(..)/g);

    // Default to black if for some reason the regex doesn't match
    if (!matches) return '#000';

    let [r, g, b, a] = matches.map(rgb => parseInt('0x' + rgb));

    // Default alpha to 255 if not provided
    if (!a) a = 255;

    return ((~~(r * 299) + ~~(g * 587) + ~~(b * 114)) / 1000) >= 128 || (!!(~(128 / a) + 1) && factorAlpha)
        ? '#000'
        : '#FFF';
}

export default function BookingCalendar({
    className,
    availableTimeRanges = [],
    availabilityRules = [],
    blockedTimes = [],
    unavailableDates = [],
    timezone,
    title,
    serviceName,
    duration,
    interval,
    minimumNotice,
    minimumNoticeUnit,
    dateRangeType,
    rollingDays,
    rollingUnit,
    fixedStartDate,
    fixedEndDate,
    onSelectDateTime,
    onDateChange,
    onBackClicked,
    onMonthChange,
    darkMode = false,
    primaryColor = '#000000',
    selectedDate,
    selectedTime,
    isLoading = false,
    hasNoEmployees = false,
    organizationName,
    organizationPhone,
    organizationEmail,
    currentMonth,
    currentYear,
    availabilityData = {}
}: BookingCalendarProps) {

    // Calculate contrasting color for the primary color
    const primaryForeground = useMemo(() => contrastingColor(primaryColor), [primaryColor]);

    // Custom CSS variables for theming
    const customStyleVars = useMemo(() => ({
        '--primary': primaryColor,
        '--primary-foreground': primaryForeground,
        '--ring': primaryColor,
    }), [primaryColor, primaryForeground]);

    // Simple lookup function for pre-calculated availability
    const getAvailableTimeSlotsForDate = useCallback((checkDate: Date): string[] => {
        const dateKey = checkDate.toISOString().split('T')[0];
        return availabilityData[dateKey] || [];
    }, [availabilityData]);

    const handleChangeDate = (newDate: Date | null) => {
        if (onDateChange) {
            onDateChange(newDate);
        }
    };

    const handleChangeAvailableTime = (time: string) => {
        if (onSelectDateTime && selectedDate) {
            onSelectDateTime(selectedDate, time);
        }
    };

    // Determine if a date is available
    const isDateAvailable = useCallback((date: Date): boolean => {
        // Check if date is in unavailable dates
        if (unavailableDates.some(unavailableDate =>
            isSameDay(date, unavailableDate)
        )) {
            return false;
        }

        // If no availability rules are provided, all dates are available
        if (availabilityRules.length === 0 && availableTimeRanges.length === 0) {
            return true;
        }

        const dayOfWeek = getDayOfWeek(date);

        // Check if date matches any availability rule
        if (availabilityRules.length > 0) {
            return availabilityRules.some(rule =>
                rule.days.includes(dayOfWeek) && rule.timeRanges.length > 0
            );
        }

        // If we have general available time ranges, all days are available
        return availableTimeRanges.length > 0;
    }, [availabilityRules, availableTimeRanges, unavailableDates]);

    // Get available time ranges for the selected date
    const getTimeRangesForDate = useCallback((date: Date): TimeRange[] => {
        const dayOfWeek = getDayOfWeek(date);

        // First check if we have specific rules for this day of week
        const rulesForDay = availabilityRules.filter(rule =>
            rule.days.includes(dayOfWeek)
        );

        if (rulesForDay.length > 0) {
            // Combine all time ranges from matching rules
            return rulesForDay.flatMap(rule => rule.timeRanges);
        }

        // Fall back to general available time ranges
        return availableTimeRanges;
    }, [availabilityRules, availableTimeRanges]);

    // Get blocked time ranges for the selected date
    const getBlockedRangesForDate = useCallback((date: Date): TimeRange[] => {
        return blockedTimes
            .filter(blocked => isSameDay(blocked.date, date))
            .flatMap(blocked => blocked.timeRanges);
    }, [blockedTimes]);

    // Get available time slots for the selected date (simplified with pre-calculated data)
    const availableTimeSlots = useMemo(() => {
        // Only show time slots if a date is selected
        if (!selectedDate) return [];

        // If we have pre-calculated availability data, use it
        if (Object.keys(availabilityData).length > 0) {
            return getAvailableTimeSlotsForDate(selectedDate);
        }

        // Fallback to original calculation if no availability data
        const slots: string[] = [];

        if (!isDateAvailable(selectedDate)) {
            return slots;
        }

        const timeRanges = getTimeRangesForDate(selectedDate);
        const blockedRanges = getBlockedRangesForDate(selectedDate);

        if (timeRanges.length === 0) {
            return slots;
        }

        timeRanges.forEach(range => {
            const startMinutes = timeToMinutes(range.start);
            const endMinutes = timeToMinutes(range.end);

            if (endMinutes <= startMinutes) {
                return;
            }

            let currentMinutes = startMinutes;

            while (currentMinutes + duration <= endMinutes) {
                const slotEnd = currentMinutes + duration;
                const isBlocked = isOverlapping(currentMinutes, slotEnd, blockedRanges);

                if (!isBlocked) {
                    slots.push(minutesToTime12h(currentMinutes));
                }

                currentMinutes += interval;
            }
        });

        return slots;
    }, [selectedDate, availabilityData, getAvailableTimeSlotsForDate, isDateAvailable, getTimeRangesForDate, getBlockedRangesForDate, duration, interval]);

    // Get day of week display and day number from the selected date (only if a date is selected)
    const dayOfWeek = selectedDate ? getDayOfWeek(selectedDate) : 0;
    const dayName = selectedDate ? DAY_NAMES[dayOfWeek] : null;
    const dayNumber = selectedDate ? selectedDate.getDate() : null;

    // Helper function to add days to a date
    const addDays = (date: Date, days: number): Date => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    // Helper function to add weekdays only
    const addWeekdays = (date: Date, weekdays: number): Date => {
        let result = new Date(date);
        let daysAdded = 0;
        
        while (daysAdded < weekdays) {
            result = addDays(result, 1);
            const dayOfWeek = result.getDay();
            // Skip weekends (0 = Sunday, 6 = Saturday)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                daysAdded++;
            }
        }
        
        return result;
    };

    // Check if a date should be disabled in the calendar
    const isDateDisabled = (calendarDate: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Apply minimum notice
        let earliestBookable = today;
        if (minimumNotice && minimumNotice > 0) {
            if (minimumNoticeUnit === 'days') {
                earliestBookable = addDays(today, minimumNotice);
            } else {
                // For hours, add to current time then round to next day if needed
                const hoursFromNow = new Date(Date.now() + minimumNotice * 60 * 60 * 1000);
                hoursFromNow.setHours(0, 0, 0, 0);
                if (hoursFromNow > today) {
                    earliestBookable = hoursFromNow;
                }
            }
        }
        
        if (calendarDate < earliestBookable) return true;
        
        // Apply date range restrictions based on type
        if (dateRangeType === 'rolling' && rollingDays) {
            const maxDate = rollingUnit === 'week-days' 
                ? addWeekdays(today, rollingDays)
                : addDays(today, rollingDays);
            if (calendarDate > maxDate) return true;
        }
        
        if (dateRangeType === 'fixed') {
            if (fixedStartDate && calendarDate < fixedStartDate) return true;
            if (fixedEndDate && calendarDate > fixedEndDate) return true;
        }
        
        // When we have availability data from API, check if date has slots
        if (Object.keys(availabilityData).length > 0) {
            const dateKey = calendarDate.toISOString().split('T')[0];
            const slots = availabilityData[dateKey] || [];
            return slots.length === 0; // Disable if no slots
        }

        // Fallback to existing availability rules
        return !isDateAvailable(calendarDate);
    };

    return (
        <div
            className={cn("w-full bg-background @container relative", darkMode ? "dark text-foreground" : "", className)}
            style={customStyleVars as React.CSSProperties}
        >
            <div className="flex flex-col @5xl:flex-row gap-6 w-full">
                {/* Left Panel - Always on top in narrow views */}
                <div className="w-full @5xl:flex-1 @5xl:border-r @5xl:pr-6">
                    <div className="grid gap-3 mb-6 @5xl:mb-0">
                        {onBackClicked && (
                            <Button
                                variant="ghost"
                                className={`flex items-center mb-2 text-muted-foreground p-0! hover:bg-transparent! hover:text-foreground! justify-start`}
                                onClick={onBackClicked}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Back
                            </Button>
                        )}
                        <p className="text-foreground text-2xl font-bold">{title}</p>
                        {serviceName && (
                            <p className="text-xl font-semibold mt-1">{serviceName}</p>
                        )}
                        <div className="flex items-center text-foreground">
                            <Clock4 className="size-4 mr-2" />
                            <p className="text-sm font-semibold">{duration} mins</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Timezone: {timezone ? timezone.replace(/_/g, " ") : 'Not set'}
                        </p>
                    </div>
                </div>

                {/* Wrapper for Calendar and Time picker - side by side on medium, stacked on narrow */}
                <div className="flex flex-col @2xl:flex-row @5xl:flex-row gap-6 w-full @5xl:flex-[2]">
                    {/* Calendar */}
                    <div className="w-full @2xl:flex-1">
                        <div className="relative">
                            <Calendar
                                value={selectedDate}
                                onChange={handleChangeDate}
                                onMonthChange={onMonthChange}
                                isDateUnavailable={isLoading ? () => true : isDateDisabled} // Disable all dates when loading
                                minValue={new Date()}
                            />
                            {isLoading && (
                                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Time Selection */}
                    <div className="flex flex-col gap-4 w-full @2xl:w-[280px] @5xl:border-l @5xl:pl-6">
                        <div className="flex justify-between items-center">
                            {selectedDate && !hasNoEmployees ? (
                                <p
                                    aria-hidden
                                    className="flex-1 align-center font-bold text-md text-foreground"
                                >
                                    {dayName} <span className="text-muted-foreground">{dayNumber}</span>
                                </p>
                            ) : hasNoEmployees ? (
                                <p
                                    aria-hidden
                                    className="flex-1 align-center font-bold text-md text-muted-foreground"
                                >
                                    No availability
                                </p>
                            ) : (
                                <p
                                    aria-hidden
                                    className="flex-1 align-center font-bold text-md text-muted-foreground"
                                >
                                    Select a date
                                </p>
                            )}
                        </div>
                        <ScrollArea className="h-full max-h-[380px]" type="always">
                            <div className="grid gap-2 @5xl:pr-3">
                                {hasNoEmployees ? (
                                    <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
                                        <p className="text-muted-foreground text-sm">
                                            There is currently no available for this service for the month of {currentMonth && currentYear ? `${MONTH_NAMES[currentMonth - 1]}, ${currentYear}` : 'the selected month'}.
                                        </p>
                                        {(organizationPhone || organizationEmail) ? (
                                            <>
                                                <p className="text-muted-foreground text-sm mb-3">
                                                    Please contact {organizationName || 'our company'} to book this service:
                                                </p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {organizationPhone && (
                                                        <a
                                                            href={`tel:${organizationPhone}`}
                                                            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors text-sm font-medium"
                                                        >
                                                            Call {organizationPhone}
                                                        </a>
                                                    )}
                                                    {organizationEmail && (
                                                        <a
                                                            href={`mailto:${organizationEmail}?subject=Service Booking Inquiry`}
                                                            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors text-sm font-medium"
                                                        >
                                                            Email {organizationEmail}
                                                        </a>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-muted-foreground text-sm">
                                                Please contact {organizationName || 'the company'} directly to book this service.
                                            </p>
                                        )}
                                    </div>
                                ) : availableTimeSlots.length > 0 ? (
                                    availableTimeSlots.map((timeSlot) => (
                                        <Button
                                            variant="outline"
                                            onClick={() => handleChangeAvailableTime(timeSlot)}
                                            key={timeSlot}
                                            className={cn(
                                                selectedTime === timeSlot
                                                    ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                                                    : ""
                                            )}
                                        >
                                            {timeSlot}
                                        </Button>
                                    ))
                                ) : !isLoading && selectedDate ? (
                                    <p className="text-center text-muted-foreground py-4">
                                        No available times for this date
                                    </p>
                                ) : !isLoading && !selectedDate ? (
                                    <p className="text-center text-muted-foreground p-4 bg-muted/50 rounded-md text-sm border border-dashed">
                                        Select a date to see available times
                                    </p>
                                ) : null}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        </div>
    );
}