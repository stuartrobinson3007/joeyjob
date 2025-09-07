"use client"

import { Column } from "@tanstack/react-table"
import { Check, PlusCircle } from "lucide-react"
import * as React from "react"

import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import {
  Faceted,
  FacetedBadgeList,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedSeparator,
  FacetedTrigger,
} from "../ui/faceted"
import { Separator } from "../ui/separator"
import { DataTableFilterOption } from "./types"
import { cn } from "../lib/utils"

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  options: DataTableFilterOption[]
  multiple?: boolean
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  multiple = true,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const selectedValues = column?.getFilterValue() as string[] | string | undefined
  const normalizedValues = React.useMemo(() => {
    if (!selectedValues) return []
    if (Array.isArray(selectedValues)) return selectedValues
    return [selectedValues]
  }, [selectedValues])

  const handleValueChange = (value: string[] | string | undefined) => {
    if (multiple) {
      column?.setFilterValue(value && (value as string[]).length ? value : undefined)
    } else {
      column?.setFilterValue(value)
    }
  }

  return (
    <Faceted
      value={multiple ? normalizedValues : normalizedValues[0]}
      onValueChange={handleValueChange as any}
      multiple={multiple}
    >
      <FacetedTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="mr-1" />
          {title}
          {normalizedValues.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <FacetedBadgeList
                options={options}
                className="space-x-1"
                badgeClassName="rounded-sm px-1 font-normal lg:hidden"
              />
              <div className="hidden space-x-1 lg:flex">
                {normalizedValues.length > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {normalizedValues.length} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => normalizedValues.includes(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </FacetedTrigger>
      <FacetedContent className="w-[200px] p-0">
        <FacetedInput placeholder={title} />
        <FacetedList>
          <FacetedEmpty>No results found.</FacetedEmpty>
          <FacetedGroup>
            {options.map((option) => {
              const isSelected = normalizedValues.includes(option.value)
              return (
                <FacetedItem
                  key={option.value}
                  value={option.value}
                >
                  {option.icon && (
                    <option.icon
                      className={cn(
                        "mr-2 h-4 w-4 text-muted-foreground",
                        isSelected && "text-foreground"
                      )}
                    />
                  )}
                  <span>{option.label}</span>
                  {option.count !== undefined && (
                    <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                      {option.count}
                    </span>
                  )}
                </FacetedItem>
              )
            })}
          </FacetedGroup>
          {normalizedValues.length > 0 && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => column?.setFilterValue(undefined)}
              >
                Clear filter
              </Button>
            </div>
          )}
        </FacetedList>
      </FacetedContent>
    </Faceted>
  )
}