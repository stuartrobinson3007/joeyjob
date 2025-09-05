/**
 * Date Range Filter Component
 * 
 * Date range picker with presets for common date ranges.
 */

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../popover";
import { Button } from "../button";
import { Calendar } from "../calendar";
import { cn } from "../../lib/utils";

interface DateRangeFilterProps {
  value: DateRange | undefined;
  onValueChange: (value: DateRange | undefined) => void;
  label?: string;
  placeholder?: string;
  presets?: string[];
  disabled?: boolean;
}

export function DateRangeFilter({
  value,
  onValueChange,
  label,
  placeholder = "Pick a date range",
  presets = [],
  disabled = false,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  const getPresetRange = (preset: string): DateRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case 'today':
        return { from: today, to: today };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: yesterday, to: yesterday };
      case 'this-week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return { from: startOfWeek, to: today };
      case 'last-7-days':
        const last7 = new Date(today);
        last7.setDate(today.getDate() - 7);
        return { from: last7, to: today };
      case 'this-month':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: startOfMonth, to: today };
      case 'last-30-days':
        const last30 = new Date(today);
        last30.setDate(today.getDate() - 30);
        return { from: last30, to: today };
      default:
        return { from: today, to: today };
    }
  };

  const formatDateRange = (range: DateRange | undefined): string => {
    if (!range?.from) return placeholder;
    if (!range.to) return format(range.from, "MMM dd, yyyy");
    if (range.from === range.to) return format(range.from, "MMM dd, yyyy");
    return `${format(range.from, "MMM dd")} - ${format(range.to, "MMM dd, yyyy")}`;
  };

  return (
    <div className="flex flex-col space-y-1">
      {label && (
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal h-8",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets */}
            {presets.length > 0 && (
              <div className="border-r">
                <div className="p-3">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        onValueChange(undefined);
                        setOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    {presets.map((preset) => (
                      <Button
                        key={preset}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          onValueChange(getPresetRange(preset));
                          setOpen(false);
                        }}
                      >
                        {preset.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Calendar */}
            <div className="p-3">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={value?.from}
                selected={value}
                onSelect={onValueChange}
                numberOfMonths={2}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}