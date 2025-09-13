// TanStack Router type extensions

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * Whether to show the sidebar for this route
     * @default true
     */
    sidebar?: boolean
    
    /**
     * Whether to skip organization access checks for this route
     * @default false - routes require organization access by default
     */
    skipOrgCheck?: boolean
  }
}

export {}
