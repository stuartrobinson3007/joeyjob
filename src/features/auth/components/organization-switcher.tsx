import { useState } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { ChevronDown, Building2, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { useListOrganizations } from '@/lib/auth/auth-hooks'

export function OrganizationSwitcher() {
  const { data: organizations, isPending } = useListOrganizations()
  const { activeOrganization, setActiveOrganization } = useActiveOrganization()
  const [isCreating, setIsCreating] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')

  const handleSwitchOrg = (orgId: string) => {
    setActiveOrganization(orgId)
    toast.success('Switched organization')
    // No need to reload - context handles the update
  }

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) {
      toast.error('Please enter an organization name')
      return
    }

    try {
      const result = await authClient.organization.create({
        name: newOrgName.trim(),
        slug: newOrgName.toLowerCase().replace(/\s+/g, '-')
      })

      if (result.error) {
        toast.error(result.error.message || 'Failed to create organization')
      } else if (result.data) {
        toast.success('Organization created!')
        setNewOrgName('')
        setIsCreating(false)
        // Set the new organization as active
        setActiveOrganization(result.data.id)
        window.location.reload() // Reload to refresh organizations list
      }
    } catch (error) {
      toast.error('Failed to create organization')
    }
  }

  if (isPending) {
    return (
      <div className="h-10 w-48 bg-muted rounded-lg animate-pulse" />
    )
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">No organizations yet</p>
        {isCreating ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="Organization name"
              className="px-3 py-1 text-sm border rounded"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateOrg()
                if (e.key === 'Escape') {
                  setIsCreating(false)
                  setNewOrgName('')
                }
              }}
            />
            <button
              onClick={handleCreateOrg}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false)
                setNewOrgName('')
              }}
              className="px-3 py-1 text-sm border rounded hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            <Plus className="w-3 h-3" />
            Create Organization
          </button>
        )}
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent">
          <Building2 />
          <span className="font-medium">
            {activeOrganization?.name || 'Select Organization'}
          </span>
          <ChevronDown className="w-4 h-4 ml-2" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitchOrg(org.id)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Building2 />
                <div>
                  <p className="font-medium">{org.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Organization
                  </p>
                </div>
              </div>
              {org.id === activeOrganization?.id && (
                <Check className="w-4 h-4 text-green-600" />
              )}
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {isCreating ? (
          <div className="p-2 space-y-2">
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="Organization name"
              className="w-full px-3 py-1 text-sm border rounded"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateOrg()
                if (e.key === 'Escape') {
                  setIsCreating(false)
                  setNewOrgName('')
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateOrg}
                className="flex-1 px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false)
                  setNewOrgName('')
                }}
                className="flex-1 px-3 py-1 text-sm border rounded hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem
            onClick={() => setIsCreating(true)}
            className="cursor-pointer"
          >
            <Plus />
            Create New Organization
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}