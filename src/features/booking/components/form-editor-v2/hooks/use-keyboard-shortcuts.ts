import { useEffect, useCallback } from 'react';

export interface KeyboardShortcuts {
  [key: string]: () => void;
}

/**
 * Custom hook for handling keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierKey = isMac ? 'Meta' : 'Control';
    
    // Build shortcut string
    let shortcut = '';
    
    if (event.getModifierState(modifierKey)) shortcut += 'cmd+';
    if (event.shiftKey) shortcut += 'shift+';
    if (event.altKey) shortcut += 'alt+';
    
    shortcut += event.key.toLowerCase();
    
    // Handle special cases
    if (event.key === ' ') shortcut = shortcut.replace(' ', 'space');
    if (event.key === 'Enter') shortcut = shortcut.replace('enter', 'return');
    
    const handler = shortcuts[shortcut];
    if (handler) {
      event.preventDefault();
      event.stopPropagation();
      handler();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}