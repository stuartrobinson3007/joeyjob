import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Command } from '../core/commands/base';

interface CommandStore {
  history: Command[];
  currentIndex: number;
  isExecuting: boolean;
  
  // Actions
  execute: (command: Command) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clear: () => void;
  
  // Computed getters
  canUndo: () => boolean;
  canRedo: () => boolean;
  getLastCommand: () => Command | null;
  getHistorySize: () => number;
}

export const useCommandStore = create<CommandStore>()(
  devtools(
    (set, get) => ({
      history: [],
      currentIndex: -1,
      isExecuting: false,
      
      execute: async (command: Command) => {
        const state = get();
        
        if (state.isExecuting) {
          console.warn('Command execution already in progress');
          return;
        }
        
        if (!command.canExecute()) {
          console.warn('Command cannot be executed:', command.description);
          return;
        }
        
        set({ isExecuting: true });
        
        try {
          await command.execute();
          
          set((state) => ({
            // Remove any commands after current index (they're no longer valid)
            history: [...state.history.slice(0, state.currentIndex + 1), command],
            currentIndex: state.currentIndex + 1,
            isExecuting: false
          }));
          
          // Limit history size to prevent memory issues
          const maxHistorySize = 50;
          const currentState = get();
          if (currentState.history.length > maxHistorySize) {
            set({
              history: currentState.history.slice(-maxHistorySize),
              currentIndex: maxHistorySize - 1
            });
          }
          
        } catch (error) {
          console.error('Command execution failed:', error);
          set({ isExecuting: false });
          throw error;
        }
      },
      
      undo: async () => {
        const state = get();
        
        if (state.isExecuting || !state.canUndo()) {
          return;
        }
        
        set({ isExecuting: true });
        
        try {
          const command = state.history[state.currentIndex];
          command.undo();
          
          set((state) => ({
            currentIndex: state.currentIndex - 1,
            isExecuting: false
          }));
          
        } catch (error) {
          console.error('Command undo failed:', error);
          set({ isExecuting: false });
          throw error;
        }
      },
      
      redo: async () => {
        const state = get();
        
        if (state.isExecuting || !state.canRedo()) {
          return;
        }
        
        set({ isExecuting: true });
        
        try {
          const command = state.history[state.currentIndex + 1];
          command.redo();
          
          set((state) => ({
            currentIndex: state.currentIndex + 1,
            isExecuting: false
          }));
          
        } catch (error) {
          console.error('Command redo failed:', error);
          set({ isExecuting: false });
          throw error;
        }
      },
      
      clear: () => set({
        history: [],
        currentIndex: -1
      }),
      
      // Computed getters
      canUndo: () => {
        const state = get();
        return state.currentIndex >= 0 && !state.isExecuting;
      },
      
      canRedo: () => {
        const state = get();
        return state.currentIndex < state.history.length - 1 && !state.isExecuting;
      },
      
      getLastCommand: () => {
        const state = get();
        return state.currentIndex >= 0 ? state.history[state.currentIndex] : null;
      },
      
      getHistorySize: () => {
        const state = get();
        return state.history.length;
      }
    }),
    { name: 'command-store' }
  )
);