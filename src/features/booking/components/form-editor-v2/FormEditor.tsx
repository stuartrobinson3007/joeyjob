import { useEffect, useCallback } from 'react';

import { BookingFlowData } from '../form-editor/types/form-editor-state';

import { useFormStore } from './stores/form-store';
import { useUIStore } from './stores/ui-store';
import { useCommands } from './hooks/use-commands';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useAutosave } from './hooks/use-autosave';
import { useOptimisticUpdates } from './hooks/use-optimistic-updates';
import { useValidation } from './hooks/use-validation';
import { eventBus } from './core/events/event-bus';
import { migrateFromOldFormat } from './core/migration/migrate';
import { TreeView } from './ui/views/TreeView';
import { ViewRouter } from './ui/layouts/ViewRouter';
import { FormEditorHeader } from './ui/widgets/FormEditorHeader';
import { FormPreview } from './ui/widgets/FormPreview';

interface FormEditorProps {
  formId: string;
  initialData?: BookingFlowData;
  onSave?: (data: any) => Promise<void>;
  onServerSync?: (data: BookingFlowData) => Promise<void>;
  enableAutosave?: boolean;
  enableOptimisticUpdates?: boolean;
}

export function FormEditor({ 
  formId, 
  initialData, 
  onSave, 
  onServerSync,
  enableAutosave = true,
  enableOptimisticUpdates = true 
}: FormEditorProps) {
  const { undo, redo, canUndo, canRedo } = useCommands();
  const { currentView, showPreview, leftPanelWidth, rightPanelWidth } = useUIStore();
  const { reset } = useFormStore();
  
  // Validation
  const { isValidating, isValid } = useValidation();
  
  // Autosave
  const { isSaving, lastSaved, forceSave } = useAutosave({
    enabled: enableAutosave,
    onSave,
    onError: (error) => {
      console.error('Autosave failed:', error);
      eventBus.emit('error.occurred', {
        source: 'autosave',
        error
      });
    }
  });
  
  // Optimistic updates
  const {
    startPeriodicSync,
    stopPeriodicSync,
    hasPendingUpdates
  } = useOptimisticUpdates({
    onServerSync: onServerSync,
    onConflict: (_local: any, server: any) => {
      // Simple conflict resolution: prefer server for most conflicts
      return server;
    }
  });

  // Initialize form data and sync
  useEffect(() => {
    if (initialData) {
      eventBus.emit('form.loaded', { formId });
      const migratedData = migrateFromOldFormat(initialData);
      reset(migratedData);
      
      // Start periodic sync if enabled
      if (enableOptimisticUpdates && onServerSync) {
        startPeriodicSync();
      }
    }
    
    return () => {
      stopPeriodicSync();
    };
  }, [formId, initialData, reset, enableOptimisticUpdates, onServerSync, startPeriodicSync, stopPeriodicSync]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'cmd+z': undo,
    'cmd+shift+z': redo,
    'cmd+s': useCallback(async () => {
      await forceSave();
    }, [forceSave])
  });

  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel - Tree View */}
      <aside 
        className="border-r border-border"
        style={{ width: leftPanelWidth }}
      >
        <TreeView />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <FormEditorHeader 
          canUndo={canUndo} 
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onSave={forceSave}
          isSaving={isSaving}
          isValidating={isValidating}
          hasErrors={!isValid}
          hasPendingUpdates={hasPendingUpdates}
          lastSaved={lastSaved}
        />
        
        <div className="flex-1 overflow-hidden">
          <ViewRouter view={currentView} />
        </div>
      </main>

      {/* Right Panel - Preview */}
      {showPreview && (
        <aside 
          className="border-l border-border"
          style={{ width: rightPanelWidth }}
        >
          <FormPreview />
        </aside>
      )}
    </div>
  );
}