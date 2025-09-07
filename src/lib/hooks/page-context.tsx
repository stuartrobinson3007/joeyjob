/**
 * Page Context System
 *
 * Provides page-level metadata and actions for TanStack Router pages.
 * Integrates with the layout system to display dynamic titles, breadcrumbs, and actions.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageContextValue {
  title: string
  setTitle: (title: string) => void
  breadcrumbs: BreadcrumbItem[]
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void
  actions: ReactNode
  setActions: (actions: ReactNode) => void
  customBreadcrumb: ReactNode
  setCustomBreadcrumb: (breadcrumb: ReactNode) => void
  reset: () => void
}

const PageContext = createContext<PageContextValue | null>(null)

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('')
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
  const [actions, setActions] = useState<ReactNode>(null)
  const [customBreadcrumb, setCustomBreadcrumb] = useState<ReactNode>(null)
  const router = useRouter()

  // Reset context on route change
  useEffect(() => {
    const reset = () => {
      setTitle('')
      setBreadcrumbs([])
      setActions(null)
      setCustomBreadcrumb(null)
    }

    // Reset when route changes
    return router.subscribe('onBeforeLoad', reset)
  }, [router])

  const reset = () => {
    setTitle('')
    setBreadcrumbs([])
    setActions(null)
    setCustomBreadcrumb(null)
  }

  return (
    <PageContext.Provider
      value={{
        title,
        setTitle,
        breadcrumbs,
        setBreadcrumbs,
        actions,
        setActions,
        customBreadcrumb,
        setCustomBreadcrumb,
        reset,
      }}
    >
      {children}
    </PageContext.Provider>
  )
}

export function usePageContext() {
  const context = useContext(PageContext)
  if (!context) {
    throw new Error('usePageContext must be used within a PageContextProvider')
  }
  return context
}

// Hook to set page metadata - can be used in any component
export function useSetPageMeta(
  meta: {
    title?: string
    breadcrumbs?: BreadcrumbItem[]
    actions?: ReactNode
    customBreadcrumb?: ReactNode
  },
  deps: any[] = []
) {
  const context = usePageContext()

  useEffect(() => {
    if (meta.title !== undefined) {
      context.setTitle(meta.title)
    }
    if (meta.breadcrumbs !== undefined) {
      context.setBreadcrumbs(meta.breadcrumbs)
    }
    if (meta.actions !== undefined) {
      context.setActions(meta.actions)
    }
    if (meta.customBreadcrumb !== undefined) {
      context.setCustomBreadcrumb(meta.customBreadcrumb)
    }

    // Cleanup on unmount
    return () => {
      context.reset()
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}
