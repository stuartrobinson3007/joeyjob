"use client"

import { Column } from "@tanstack/react-table"
import { CalendarIcon, X } from "lucide-react"
import * as React from "react"
import { format } from "date-fns"

import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Calendar } from "../ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover"
import { cn } from "../lib/utils"

interface DataTableDateFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  isRange?: boolean
}

export function DataTableDateFilter<TData, TValue>({
  column,
  title,
  isRange = false,
}: DataTableDateFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false)
  const value = column?.getFilterValue() as Date | [Date, Date] | undefined

  const handleSelect = (date: Date | undefined) => {
    if (!isRange) {
      column?.setFilterValue(date)
      setOpen(false)
    }
  }

  const handleRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (isRange && range?.from && range?.to) {
      column?.setFilterValue([range.from, range.to])
    } else if (isRange && range?.from) {
      column?.setFilterValue([range.from, range.from])
    } else {
      column?.setFilterValue(undefined)
    }
  }

  const displayValue = React.useMemo(() => {
    if (!value) return title || "Pick a date"

    if (isRange && Array.isArray(value)) {
      const [from, to] = value
      if (from && to && from.getTime() !== to.getTime()) {
        return `${format(from, "MMM d")} - ${format(to, "MMM d")}`
      } else if (from) {
        return format(from, "MMM d, yyyy")
      }
    } else if (value instanceof Date) {
      return format(value, "MMM d, yyyy")
    }

    return title || "Pick a date"
  }, [value, title, isRange])

  const hasValue = Boolean(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 border-dashed"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div>
          {isRange ? (
            <Calendar
              mode="range"
              selected={
                Array.isArray(value) && value[0] && value[1]
                  ? { from: value[0], to: value[1] }
                  : undefined
              }
              onSelect={handleRangeSelect as any}
              initialFocus
            />
          ) : (
            <Calendar
              mode="single"
              selected={value as Date}
              onSelect={handleSelect}
              initialFocus
            />
          )}
          {hasValue && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => {
                  column?.setFilterValue(undefined)
                  setOpen(false)
                }}
              >
                Clear filter
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}