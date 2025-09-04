/**
 * Bulk Actions Bar Component
 * 
 * Floating action bar that appears when rows are selected.
 * Shows selection count and available bulk actions.
 */

import { Button } from "../button";
import { Badge } from "../badge";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface BulkActionConfig {
  id: string;
  label: string;
  icon?: any;
  variant?: 'default' | 'destructive';
  confirmationMessage?: string;
  showInToolbar?: boolean;
}

interface SelectionState {
  selectedRows: string[];
  isAllSelected: boolean;
  isPageSelected: boolean;
  totalCount: number;
  pageCount: number;
  selectionMode: 'page' | 'all';
}

interface DataTableBulkActionsProps {
  selection: SelectionState;
  bulkActions: BulkActionConfig[];
  onBulkAction: (actionId: string) => void;
  onClearSelection: () => void;
  onSelectAll?: () => void;
  loading?: boolean;
  className?: string;
}

export function DataTableBulkActions({
  selection,
  bulkActions,
  onBulkAction,
  onClearSelection,
  onSelectAll,
  loading = false,
  className,
}: DataTableBulkActionsProps) {
  if (selection.selectedRows.length === 0) {
    return null;
  }

  const selectedCount = selection.selectedRows.length;
  const showSelectAllOption = 
    !selection.isAllSelected && 
    selection.isPageSelected && 
    selection.totalCount > selection.pageCount &&
    onSelectAll;

  return (
    <div className={cn(
      "fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50",
      "bg-background border rounded-lg shadow-lg p-4",
      "flex items-center space-x-4",
      "animate-in slide-in-from-bottom-2 duration-200",
      className
    )}>
      {/* Selection Info */}
      <div className="flex items-center space-x-2">
        <Badge variant="secondary">
          {selectedCount} selected
        </Badge>
        
        {showSelectAllOption && (
          <Button
            variant="link"
            size="sm"
            onClick={onSelectAll}
            className="h-auto p-0 text-xs"
          >
            Select all {selection.totalCount} items
          </Button>
        )}
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center space-x-2">
        {bulkActions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant || "default"}
            size="sm"
            onClick={() => onBulkAction(action.id)}
            disabled={loading}
            className="h-8"
          >
            {action.icon && <action.icon className="h-4 w-4 mr-2" />}
            {action.label}
          </Button>
        ))}
      </div>

      {/* Clear Selection */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        disabled={loading}
        className="h-8 w-8 p-0"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Clear selection</span>
      </Button>
    </div>
  );
}