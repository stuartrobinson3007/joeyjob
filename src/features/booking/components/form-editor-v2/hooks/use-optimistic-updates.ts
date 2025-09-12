import { useCallback, useRef } from 'react';
import { useFormStore } from '../stores/form-store';
import { eventBus } from '../core/events/event-bus';
import { FormState } from '../core/models/types';
import { migrateFromOldFormat } from '../core/migration/migrate';
import { BookingFlowData } from '../../form-editor/types/form-editor-state';

export interface OptimisticUpdateOptions {
  onServerSync?: (serverData: BookingFlowData) => Promise<void>;
  onConflict?: (localData: FormState, serverData: FormState) => FormState;
  syncIntervalMs?: number;
}

interface PendingUpdate {
  id: string;
  timestamp: number;
  operation: string;
  data: any;
}

export function useOptimisticUpdates({
  onServerSync,
  onConflict,
  syncIntervalMs = 30000 // 30 seconds
}: OptimisticUpdateOptions = {}) {
  const { reset } = useFormStore();
  const pendingUpdatesRef = useRef<Map<string, PendingUpdate>>(new Map());
  const lastSyncRef = useRef<Date>(new Date());
  const syncTimeoutRef = useRef<NodeJS.Timeout>();

  // Three-way merge function to resolve conflicts
  const mergeStates = useCallback((
    base: FormState,
    local: FormState,
    server: FormState
  ): FormState => {
    if (onConflict) {
      return onConflict(local, server);
    }

    // Default merge strategy - server wins for conflicts, local changes preserved if no conflict
    const merged = { ...server };
    
    // Merge nodes - preserve local additions that don't conflict
    Object.keys(local.nodes).forEach(nodeId => {
      const localNode = local.nodes[nodeId];
      const serverNode = server.nodes[nodeId];
      const baseNode = base.nodes[nodeId];
      
      // If node was added locally and doesn't exist on server, keep it
      if (localNode && !serverNode && !baseNode) {
        merged.nodes[nodeId] = localNode;
      }
      // If node exists in both, merge properties
      else if (localNode && serverNode) {
        // Server wins for most conflicts, but preserve local-only changes
        merged.nodes[nodeId] = {
          ...serverNode,
          // Example: preserve local description if server didn't change it
          ...(localNode.type === 'service' && baseNode?.type === 'service' && 
              serverNode.type === 'service' && 
              (serverNode as any).description === (baseNode as any).description ? 
              { description: (localNode as any).description } : {})
        };
      }
    });
    
    // Merge questions similarly
    Object.keys(local.questions).forEach(questionId => {
      const localQuestion = local.questions[questionId];
      const serverQuestion = server.questions[questionId];
      const baseQuestion = base.questions[questionId];
      
      if (localQuestion && !serverQuestion && !baseQuestion) {
        merged.questions[questionId] = localQuestion;
      }
    });
    
    return merged;
  }, [onConflict]);

  // Apply optimistic update locally
  const applyOptimisticUpdate = useCallback((
    operationId: string,
    operation: string,
    updateFn: () => void
  ) => {
    // Store the pending update
    pendingUpdatesRef.current.set(operationId, {
      id: operationId,
      timestamp: Date.now(),
      operation,
      data: useFormStore.getState()
    });

    // Apply the update optimistically
    updateFn();

    eventBus.emit('form.updated', { 
      formId: useFormStore.getState().id, 
      changes: { operation, optimistic: true } 
    });
  }, []);

  // Sync with server data
  const syncWithServer = useCallback(async (serverData: BookingFlowData) => {
    const currentState = useFormStore.getState();
    const baseState = migrateFromOldFormat(serverData);
    
    // If no pending updates, just update to server state
    if (pendingUpdatesRef.current.size === 0) {
      reset(baseState);
      lastSyncRef.current = new Date();
      return;
    }

    // Perform three-way merge
    const mergedState = mergeStates(
      baseState, // base (server state)
      currentState, // local (current state with optimistic updates)
      baseState // server (same as base in this case)
    );

    // Apply merged state
    reset(mergedState);
    
    // Clear resolved pending updates (simple heuristic - clear all after sync)
    pendingUpdatesRef.current.clear();
    lastSyncRef.current = new Date();

    eventBus.emit('form.updated', { 
      formId: currentState.id, 
      changes: { merged: true } 
    });
  }, [reset, mergeStates]);

  // Rollback optimistic update on failure
  const rollbackUpdate = useCallback((operationId: string) => {
    const pendingUpdate = pendingUpdatesRef.current.get(operationId);
    if (pendingUpdate) {
      // Restore state from before the optimistic update
      reset(pendingUpdate.data);
      pendingUpdatesRef.current.delete(operationId);
      
      eventBus.emit('form.updated', { 
        formId: useFormStore.getState().id, 
        changes: { rollback: true, operationId } 
      });
    }
  }, [reset]);

  // Periodic sync with server
  const startPeriodicSync = useCallback(() => {
    if (!onServerSync || syncTimeoutRef.current) return;

    const sync = async () => {
      try {
        await onServerSync();
      } catch (error) {
        console.error('Periodic sync failed:', error);
      } finally {
        syncTimeoutRef.current = setTimeout(sync, syncIntervalMs);
      }
    };

    syncTimeoutRef.current = setTimeout(sync, syncIntervalMs);
  }, [onServerSync, syncIntervalMs]);

  const stopPeriodicSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = undefined;
    }
  }, []);

  return {
    applyOptimisticUpdate,
    syncWithServer,
    rollbackUpdate,
    startPeriodicSync,
    stopPeriodicSync,
    hasPendingUpdates: pendingUpdatesRef.current.size > 0,
    pendingUpdateCount: pendingUpdatesRef.current.size,
    lastSync: lastSyncRef.current
  };
}