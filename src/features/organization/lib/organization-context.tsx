import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { getActiveOrganizationId, setActiveOrganizationId as setOrgId } from './organization-utils'
import { useListOrganizations } from '@/lib/auth/auth-hooks'

interface OrganizationContextValue {
  activeOrganizationId: string | null
  activeOrganization: any | null
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
      } else if (organizations && organizations.length > 0) {
        // If no stored org, use the first available
        const firstOrgId = organizations[0].id
        setActiveOrganizationId(firstOrgId)
        setOrgId(firstOrgId) // Use the utility function to set it in storage
      }
    }
  }, [organizations])

  // Listen for storage changes (cross-tab sync - optional)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'activeOrganizationId' && e.newValue) {
        // Update sessionStorage to sync tabs
        sessionStorage.setItem('activeOrganizationId', e.newValue)
        setActiveOrganizationId(e.newValue)
      }
    }

    const handleOrgChange = (e: CustomEvent) => {
      setActiveOrganizationId(e.detail)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('org-changed' as any, handleOrgChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('org-changed' as any, handleOrgChange)
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
        isLoading: isPending
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