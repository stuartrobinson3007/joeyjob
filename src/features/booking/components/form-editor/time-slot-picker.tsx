import React from 'react'
import { Button } from '@/ui/button'
import { ScrollArea } from '@/ui/scroll-area'
import { Clock4 } from 'lucide-react'
import { cn } from '@/taali/lib/utils'

export interface TimeSlotPickerProps {
  availableSlots: string[]
  selectedSlot: string | null
  onSelectSlot: (slot: string) => void
  duration: number
  className?: string
  disabled?: boolean
}

export function TimeSlotPicker({
  availableSlots,
  selectedSlot,
  onSelectSlot,
  duration,
  className,
  disabled = false
}: TimeSlotPickerProps) {
  if (!availableSlots.length) {
    return (
      <div className={cn("p-6 text-center", className)}>
        <Clock4 className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          No available time slots for this date
        </p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock4 className="h-4 w-4" />
        <span>Available times ({duration} min)</span>
      </div>
      
      <ScrollArea className="h-64 w-full">
        <div className="grid grid-cols-3 gap-2 p-1">
          {availableSlots.map((slot) => {
            const isSelected = selectedSlot === slot
            
            return (
              <Button
                key={slot}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                disabled={disabled}
                onClick={() => onSelectSlot(slot)}
                className={cn(
                  "text-xs transition-all",
                  isSelected && "shadow-md",
                  !isSelected && "hover:border-primary"
                )}
              >
                {slot}
              </Button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}