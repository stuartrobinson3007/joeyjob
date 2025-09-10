import { Calendar } from "../calendar";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/ui/button";
import { ScrollArea } from "@/ui/scroll-area";
import { Clock4, ArrowLeft, ChevronLeft } from "lucide-react";
import { cn } from "@/taali/lib/utils";
import { isSameDay, parseISO, format, startOfDay, addDays } from 'date-fns';

// Day names mapping for display
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    onSelectDateTime?: (date: Date, time: string) => void;
    onBackClicked?: () => void; // Callback when back button is clicked
    darkMode?: boolean;
    primaryColor?: string; // Primary color for selected elements
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
    bufferTime = 0,
    interval = 30,
    onSelectDateTime,
    onBackClicked,
    darkMode = false,
    primaryColor = '#000000'
}: BookingCalendarProps) {
    const [date, setDate] = useState<Date>(new Date());
    const [focusedDate, setFocusedDate] = useState<Date | null>(date);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [initializedAvailableDate, setInitializedAvailableDate] = useState(false);

    // Calculate contrasting color for the primary color
    const primaryForeground = useMemo(() => contrastingColor(primaryColor), [primaryColor]);

    // Custom CSS variables for theming
    const customStyleVars = useMemo(() => ({
        '--custom-primary': primaryColor,
        '--custom-primary-foreground': primaryForeground,
        '--ring': primaryColor,
    }), [primaryColor, primaryForeground]);

    const handleChangeDate = (selectedDate: Date | null) => {
        if (selectedDate) {
            setDate(selectedDate);
            setSelectedTime(null);
        }
    };

    const handleChangeAvailableTime = (time: string) => {
        setSelectedTime(time);
        if (onSelectDateTime && date) {
            onSelectDateTime(date, time);
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

    // Check if a date has any available time slots
    const hasAvailableTimeSlots = useCallback((date: Date): boolean => {
        if (!isDateAvailable(date)) {
            return false;
        }

        // Get available and blocked time ranges for this date
        const timeRanges = getTimeRangesForDate(date);
        const blockedRanges = getBlockedRangesForDate(date);

        // If no time ranges available, return false
        if (timeRanges.length === 0) {
            return false;
        }

        // Check if any time range has at least one valid slot
        for (const range of timeRanges) {
            const startMinutes = timeToMinutes(range.start);
            const endMinutes = timeToMinutes(range.end);

            if (endMinutes <= startMinutes) {
                continue;
            }

            let currentMinutes = startMinutes;
            while (currentMinutes + duration <= endMinutes) {
                const slotEnd = currentMinutes + duration;
                const isBlocked = isOverlapping(currentMinutes, slotEnd, blockedRanges);

                if (!isBlocked) {
                    return true;
                }

                currentMinutes += interval;
            }
        }

        return false;
    }, [isDateAvailable, getTimeRangesForDate, getBlockedRangesForDate, duration, interval]);

    // Find the first available date with time slots
    const findFirstAvailableDate = useCallback((): Date | null => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of day

        // Check today and the next DAYS_TO_SEARCH days
        for (let i = 0; i < DAYS_TO_SEARCH; i++) {
            const checkDate = addDays(today, i);
            if (hasAvailableTimeSlots(checkDate)) {
                return checkDate;
            }
        }

        return null;
    }, [hasAvailableTimeSlots]);

    // Initialize to the first available date on mount
    useEffect(() => {
        if (!initializedAvailableDate) {
            const firstAvailableDate = findFirstAvailableDate();
            if (firstAvailableDate) {
                setDate(firstAvailableDate);
                setFocusedDate(firstAvailableDate);
                setInitializedAvailableDate(true);
            }
        }
    }, [findFirstAvailableDate, initializedAvailableDate]);

    // Calculate available time slots for the selected date
    const availableTimeSlots = useMemo(() => {
        const slots: string[] = [];

        if (!isDateAvailable(date)) {
            return slots;
        }

        // Get available and blocked time ranges for this date
        const timeRanges = getTimeRangesForDate(date);
        const blockedRanges = getBlockedRangesForDate(date);

        // If no time ranges available, return empty slots
        if (timeRanges.length === 0) {
            return slots;
        }

        // Process each time range
        timeRanges.forEach(range => {
            const startMinutes = timeToMinutes(range.start);
            const endMinutes = timeToMinutes(range.end);

            // Skip if end time is before or equal to start time
            if (endMinutes <= startMinutes) {
                return;
            }

            // Calculate slots within the range
            const totalDuration = duration + bufferTime;
            let currentMinutes = startMinutes;

            while (currentMinutes + duration <= endMinutes) {
                // Check if this slot overlaps with any blocked times
                const slotEnd = currentMinutes + duration;
                const isBlocked = isOverlapping(currentMinutes, slotEnd, blockedRanges);

                if (!isBlocked) {
                    slots.push(minutesToTime12h(currentMinutes));
                }

                currentMinutes += interval;
            }
        });

        return slots;
    }, [date, isDateAvailable, getTimeRangesForDate, getBlockedRangesForDate, duration, bufferTime, interval]);

    // Get day of week display and day number from the Date
    const dayOfWeek = getDayOfWeek(date);
    const dayName = DAY_NAMES[dayOfWeek];
    const dayNumber = date.getDate();

    // Check if a date should be disabled in the calendar
    const isDateDisabled = (calendarDate: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Disable past dates
        if (calendarDate < today) return true;
        
        // Check if date is unavailable or has no time slots
        return !isDateAvailable(calendarDate);
    };

    return (
        <div
            className={cn("w-full bg-background @container", darkMode ? "dark text-foreground" : "", className)}
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
                            Timezone: {timezone.replace(/_/g, " ")}
                        </p>
                    </div>
                </div>

                {/* Wrapper for Calendar and Time picker - side by side on medium, stacked on narrow */}
                <div className="flex flex-col @2xl:flex-row @5xl:flex-row gap-6 w-full @5xl:flex-[2]">
                    {/* Calendar */}
                    <div className="w-full @2xl:flex-1">
                        <Calendar
                            value={date}
                            onChange={handleChangeDate}
                            isDateUnavailable={isDateDisabled}
                            minValue={new Date()}
                        />
                    </div>

                    {/* Right Panel - Time Selection */}
                    <div className="flex flex-col gap-4 w-full @2xl:w-[280px] @5xl:border-l @5xl:pl-6">
                        <div className="flex justify-between items-center">
                            <p
                                aria-hidden
                                className="flex-1 align-center font-bold text-md text-foreground"
                            >
                                {dayName} <span className="text-muted-foreground">{dayNumber}</span>
                            </p>
                        </div>
                        <ScrollArea className="h-full max-h-[380px]">
                            <div className="grid gap-2 @5xl:pr-3">
                                {availableTimeSlots.length > 0 ? (
                                    availableTimeSlots.map((timeSlot) => (
                                        <Button
                                            variant="outline"
                                            onClick={() => handleChangeAvailableTime(timeSlot)}
                                            key={timeSlot}
                                            className={cn(
                                                selectedTime === timeSlot
                                                    ? "bg-[var(--custom-primary)] text-[var(--custom-primary-foreground)] hover:bg-[var(--custom-primary)] hover:text-[var(--custom-primary-foreground)]"
                                                    : ""
                                            )}
                                        >
                                            {timeSlot}
                                        </Button>
                                    ))
                                ) : (
                                    <p className="text-center text-muted-foreground py-4">
                                        No available times for this date
                                    </p>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        </div>
    );
}