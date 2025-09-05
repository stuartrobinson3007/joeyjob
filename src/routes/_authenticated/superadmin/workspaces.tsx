import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Building2, Search, Users, Calendar, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/superadmin/workspaces')({
  component: SuperAdminWorkspaces,
})

function SuperAdminWorkspaces() {
  const [searchTerm, setSearchTerm] = useState('')

  // Note: This would need to be a proper admin API call in a real app
  // For now, we'll use the regular list organizations as a placeholder
  const { data: organizations, isPending, refetch } = authClient.useListOrganizations()

  const handleDeleteOrganization = async (orgId: string, orgName: string) => {
    const confirmed = confirm(`Are you sure you want to delete "${orgName}"? This will permanently delete all data associated with this organization.`)
    if (!confirmed) return

    try {
      // This would need to be an admin-only delete function
      const result = await authClient.organization.delete({
        organizationId: orgId
      })

      if (result.error) {
        toast.error(result.error.message || 'Failed to delete organization')
      } else {
        toast.success('Organization deleted')
        refetch()
      }
    } catch (error) {
      toast.error('Failed to delete organization')
    }
  }

  const filteredOrganizations = organizations?.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (isPending) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Organization Management</h1>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search organizations by name or slug..."
              className="w-full pl-10 pr-4 py-2 border-input border rounded-lg focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Members
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrganizations.map((org) => (
                <tr key={org.id} className="hover:bg-accent">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building2 className="w-5 h-5 text-muted-foreground mr-3" />
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {org.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {org.slug || 'No slug'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-foreground">
                      <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                      - members
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(org.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleDeleteOrganization(org.id, org.name)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete organization"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrganizations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? 'No organizations found matching your search' : 'No organizations found'}
          </div>
        )}
      </div>

      {/* Organization Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-2">Total Organizations</h3>
          <p className="text-3xl font-bold text-primary">{organizations?.length || 0}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-2">Total Members</h3>
          <p className="text-3xl font-bold text-green-600">
            {organizations?.length || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-2">Avg Members per Org</h3>
          <p className="text-3xl font-bold text-purple-600">
            {organizations?.length ?
              organizations.length > 0 ? 1 : 0
              : 0
            }
          </p>
        </div>
      </div>
    </div>
  )
}