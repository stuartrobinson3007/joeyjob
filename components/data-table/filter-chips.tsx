/**
 * Filter Chips Component
 * 
 * Visual representation of active filters with remove buttons.
 */

import { X } from "lucide-react";
import { Badge } from "../badge";
import { Button } from "../button";

interface FilterChip {
  key: string;
  label: string;
  value: string;
  displayValue: string;
}

interface FilterChipsProps {
  filters: Record<string, any>;
  filterConfig: Record<string, any>;
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
  className?: string;
}

export function FilterChips({
  filters,
  filterConfig,
  onRemoveFilter,
  onClearAll,
  className,
}: FilterChipsProps) {
  const activeFilters: FilterChip[] = Object.entries(filters)
    .filter(([_key, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => {
      const config = filterConfig[key];
      const label = config?.label || key;
      
      let displayValue = value;
      
      // Format display value based on filter type
      if (config?.type === 'select' && config?.options) {
        const option = config.options.find((opt: any) => opt.value === value);
        displayValue = option?.label || value;
      } else if (config?.type === 'boolean') {
        displayValue = value ? 'Yes' : 'No';
      } else if (config?.type === 'date-range' && typeof value === 'object') {
        displayValue = `${value.from} - ${value.to}`;
      }

      return {
        key,
        label,
        value,
        displayValue: String(displayValue),
      };
    });

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {activeFilters.map((filter) => (
        <Badge
          key={filter.key}
          variant="secondary"
          className="rounded-sm px-2 py-1 text-xs font-normal"
        >
          <span className="font-medium">{filter.label}:</span>
          <span className="ml-1">{filter.displayValue}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onRemoveFilter(filter.key)}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove {filter.label} filter</span>
          </Button>
        </Badge>
      ))}
      
      {activeFilters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 px-2 text-xs"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}