import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

import { getActiveOrganizationId, setActiveOrganizationId as setOrgId } from './organization-utils'

import { useListOrganizations } from '@/lib/auth/auth-hooks'
import type { Organization } from '@/types/organization'

interface OrganizationContextValue {
  activeOrganizationId: string | null
  activeOrganization: Organization | null
  setActiveOrganization: (orgId: string) => void
  isLoading: boolean
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { data: organizations, isPending } = useListOrganizations()
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null)


  // Initialize active organization from storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const orgId = getActiveOrganizationId()


      if (orgId) {
        setActiveOrganizationId(orgId)
      }
      // Don't auto-select first organization anymore
      // Let the user explicitly choose via the organization selector page
    }
  }, [organizations])

  // Listen for same-tab organization changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOrgChange = (e: CustomEvent) => {
      setActiveOrganizationId(e.detail)
    }

    window.addEventListener('org-changed' as keyof WindowEventMap, handleOrgChange as EventListener)

    return () => {
      window.removeEventListener('org-changed' as keyof WindowEventMap, handleOrgChange as EventListener)
    }
  }, [])

  const setActiveOrganization = (orgId: string) => {
    
    // Use the utility function to handle storage and event dispatch
    setOrgId(orgId)
    setActiveOrganizationId(orgId)
  }

  const activeOrganization = organizations?.find(org => org.id === activeOrganizationId) || null

  return (
    <OrganizationContext.Provider
      value={{
        activeOrganizationId,
        activeOrganization,
        setActiveOrganization,
        isLoading: isPending,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useActiveOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useActiveOrganization must be used within an OrganizationProvider')
  }
  return context
}
