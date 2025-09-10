import React, { createContext, useContext, ReactNode } from 'react';

interface PortalContainerContextType {
  container?: Element | null;
}

const PortalContainerContext = createContext<PortalContainerContextType>({
  container: undefined,
});

interface PortalContainerProviderProps {
  container?: Element | null;
  children: ReactNode;
}

/**
 * Provides a container element for portal components to render into.
 * When not provided, portal components will use their default behavior (document.body).
 * Used in form preview to ensure portals inherit the correct theme.
 */
export function PortalContainerProvider({ container, children }: PortalContainerProviderProps) {
  return (
    <PortalContainerContext.Provider value={{ container }}>
      {children}
    </PortalContainerContext.Provider>
  );
}

/**
 * Hook to get the current portal container.
 * Returns undefined when not within a PortalContainerProvider.
 */
export function usePortalContainer() {
  const context = useContext(PortalContainerContext);
  return context.container;
}