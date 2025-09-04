/**
 * Select Filter Component
 * 
 * Dropdown filter for predefined options with optional counts.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select";
import { Badge } from "../badge";

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface SelectFilterProps {
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  options: FilterOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

export function SelectFilter({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  label,
  disabled = false,
}: SelectFilterProps) {
  return (
    <div className="flex flex-col space-y-1">
      {label && (
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <Select
        value={value || "all"}
        onValueChange={(newValue) => onValueChange(newValue === "all" ? undefined : newValue)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-[150px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center justify-between w-full">
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {option.count}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}