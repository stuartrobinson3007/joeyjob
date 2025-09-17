import { Node, Question } from '../models/types';

// Validation error type
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}
import { FormFieldConfig } from '@/features/booking/lib/form-field-types';

/**
 * Event map defining all events and their payload types
 */
export type EventMap = {
  // Node events
  'node.selected': { nodeId: string };
  'node.created': { nodeId: string; node: Node };
  'node.updated': { nodeId: string; changes: Partial<Node>; previousData: Partial<Node> };
  'node.deleted': { nodeId: string; deletedNode: Node };
  'node.moved': { nodeId: string; fromParentId: string | null; toParentId: string };
  
  // Question events
  'question.created': { questionId: string; question: Question };
  'question.updated': { questionId: string; changes: FormFieldConfig; previousConfig: FormFieldConfig };
  'question.deleted': { questionId: string; deletedQuestion: Question };
  'question.reordered': { serviceId: string; newOrder: string[]; previousOrder: string[] };
  
  // Form events
  'form.loaded': { formId: string };
  'form.saved': { formId: string; timestamp: Date };
  'form.save.started': { formId: string };
  'form.save.failed': { formId: string; error: string };
  'form.updated': { formId: string; changes: any };
  
  // Validation events
  'validation.started': { formId: string };
  'validation.completed': { formId: string; errors: ValidationError[] };
  'validation.failed': { formId: string; error: string };
  
  // UI events
  'ui.view.changed': { previousView: string; currentView: string };
  'ui.panel.resized': { panel: 'left' | 'right'; width: number };
  'ui.dialog.opened': { dialogId: string };
  'ui.dialog.closed': { dialogId: string };
  
  // Command events
  'command.executed': { commandId: string; description: string };
  'command.undone': { commandId: string; description: string };
  'command.redone': { commandId: string; description: string };
  'command.failed': { commandId: string; error: string };
  
  // Error events
  'error.occurred': { source: string; error: Error; context?: any };
  'error.recovered': { source: string; error: Error };
};

/**
 * Type-safe event handler
 */
export type EventHandler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

/**
 * Event bus implementation for loose coupling between components
 */
class EventBus {
  private listeners = new Map<string, Set<Function>>();
  private debugMode = process.env.NODE_ENV === 'development';

  /**
   * Subscribe to an event
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(handler);
    
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler);
      if (this.debugMode) {
      }
    };
  }

  /**
   * Subscribe to an event only once
   */
  once<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<K>
  ): () => void {
    const wrappedHandler = (payload: EventMap[K]) => {
      handler(payload);
      unsubscribe();
    };
    
    const unsubscribe = this.on(event, wrappedHandler as EventHandler<K>);
    return unsubscribe;
  }

  /**
   * Emit an event
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const listeners = this.listeners.get(event);
    
    
    if (listeners) {
      // Create a copy of listeners to avoid issues if handlers modify the set
      const handlersArray = Array.from(listeners);
      
      handlersArray.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[EventBus] Error in event handler for ${event}:`, error);
          
          // Emit error event if it's not already an error event to avoid infinite loops
          if (event !== 'error.occurred') {
            this.emit('error.occurred', {
              source: 'event-bus',
              error: error as Error,
              context: { event, payload }
            });
          }
        }
      });
    }
  }

  /**
   * Remove all listeners for a specific event
   */
  off<K extends keyof EventMap>(event: K): void {
    this.listeners.delete(event);
    
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.listeners.clear();
    
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.listeners.get(event)?.size || 0;
  }

  /**
   * Get all events that have listeners
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}

// Create singleton instance
export const eventBus = new EventBus();

/**
 * React hook for subscribing to events
 */
import { useEffect, useCallback } from 'react';

export function useEventSubscription<K extends keyof EventMap>(
  event: K,
  handler: EventHandler<K>,
  deps?: any[]
): void {
  const memoizedHandler = useCallback(handler, deps || []);

  useEffect(() => {
    return eventBus.on(event, memoizedHandler);
  }, [event, memoizedHandler]);
}

/**
 * React hook for emitting events
 */
export function useEventEmitter() {
  return useCallback(<K extends keyof EventMap>(event: K, payload: EventMap[K]) => {
    eventBus.emit(event, payload);
  }, []);
}