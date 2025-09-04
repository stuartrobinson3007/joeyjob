/**
 * Keyboard Navigation Utilities
 * 
 * Enhanced keyboard navigation for data tables.
 * Adapted from tnks-data-table for accessibility and power user workflows.
 */

import type { Table } from "@tanstack/react-table";
import type { KeyboardEvent } from "react";

/**
 * Creates a keyboard navigation handler for data tables
 * 
 * Supports:
 * - Arrow keys for navigation
 * - Space to toggle selection
 * - Enter to activate/view a row
 * - Escape to clear focus
 */
export function createKeyboardNavigationHandler<TData>(
  table: Table<TData>,
  onRowActivate?: (row: TData, rowIndex: number) => void
) {
  return (e: KeyboardEvent) => {
    const { key } = e;
    const target = e.target as HTMLElement;
    
    // Don't interfere with input elements
    if (target.matches('input, button, select, textarea, [role="button"], [contenteditable="true"]')) {
      return;
    }

    // Handle different key presses
    switch (key) {
      case 'ArrowDown':
        e.preventDefault();
        navigateToNextRow();
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateToPreviousRow();
        break;
      case ' ':
        e.preventDefault();
        toggleCurrentRowSelection();
        break;
      case 'Enter':
        e.preventDefault();
        activateCurrentRow();
        break;
      case 'Escape':
        e.preventDefault();
        clearFocus();
        break;
    }

    function navigateToNextRow() {
      const currentRow = document.querySelector('[data-focused="true"]') as HTMLElement;
      if (!currentRow) {
        // Focus first row if none focused
        const firstRow = document.querySelector('[data-row-index="0"]') as HTMLElement;
        if (firstRow) {
          firstRow.setAttribute('data-focused', 'true');
          firstRow.focus();
        }
        return;
      }

      const nextRow = currentRow.nextElementSibling as HTMLElement;
      if (nextRow && nextRow.hasAttribute('data-row-index')) {
        currentRow.removeAttribute('data-focused');
        nextRow.setAttribute('data-focused', 'true');
        nextRow.focus();
      }
    }

    function navigateToPreviousRow() {
      const currentRow = document.querySelector('[data-focused="true"]') as HTMLElement;
      if (!currentRow) return;

      const prevRow = currentRow.previousElementSibling as HTMLElement;
      if (prevRow && prevRow.hasAttribute('data-row-index')) {
        currentRow.removeAttribute('data-focused');
        prevRow.setAttribute('data-focused', 'true');
        prevRow.focus();
      }
    }

    function toggleCurrentRowSelection() {
      const currentRow = document.querySelector('[data-focused="true"]') as HTMLElement;
      if (!currentRow) return;

      const rowIndex = parseInt(currentRow.getAttribute('data-row-index') || '0');
      const row = table.getRowModel().rows[rowIndex];
      if (row) {
        row.toggleSelected();
      }
    }

    function activateCurrentRow() {
      const currentRow = document.querySelector('[data-focused="true"]') as HTMLElement;
      if (!currentRow || !onRowActivate) return;

      const rowIndex = parseInt(currentRow.getAttribute('data-row-index') || '0');
      const row = table.getRowModel().rows[rowIndex];
      if (row) {
        onRowActivate(row.original, rowIndex);
      }
    }

    function clearFocus() {
      const currentRow = document.querySelector('[data-focused="true"]') as HTMLElement;
      if (currentRow) {
        currentRow.removeAttribute('data-focused');
        currentRow.blur();
      }
    }
  };
}