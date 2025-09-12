import { useCallback } from 'react';
import { Command } from '../core/commands/base';
import { useCommandStore } from '../stores/command-store';
import { eventBus } from '../core/events/event-bus';

/**
 * Custom hook for command execution with event integration
 */
export function useCommands() {
  const { execute, undo, redo, canUndo, canRedo, clear } = useCommandStore();

  const executeCommand = useCallback(async (command: Command) => {
    try {
      await execute(command);
      eventBus.emit('command.executed', {
        commandId: command.id,
        description: command.description
      });
    } catch (error) {
      eventBus.emit('command.failed', {
        commandId: command.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }, [execute]);

  const undoCommand = useCallback(async () => {
    const lastCommand = useCommandStore.getState().getLastCommand();
    if (!lastCommand) return;

    try {
      await undo();
      eventBus.emit('command.undone', {
        commandId: lastCommand.id,
        description: lastCommand.description
      });
    } catch (error) {
      eventBus.emit('command.failed', {
        commandId: lastCommand.id,
        error: error instanceof Error ? error.message : 'Undo failed'
      });
      throw error;
    }
  }, [undo]);

  const redoCommand = useCallback(async () => {
    const state = useCommandStore.getState();
    const nextCommand = state.history[state.currentIndex + 1];
    if (!nextCommand) return;

    try {
      await redo();
      eventBus.emit('command.redone', {
        commandId: nextCommand.id,
        description: nextCommand.description
      });
    } catch (error) {
      eventBus.emit('command.failed', {
        commandId: nextCommand.id,
        error: error instanceof Error ? error.message : 'Redo failed'
      });
      throw error;
    }
  }, [redo]);

  return {
    execute: executeCommand,
    undo: undoCommand,
    redo: redoCommand,
    canUndo: canUndo(),
    canRedo: canRedo(),
    clear
  };
}