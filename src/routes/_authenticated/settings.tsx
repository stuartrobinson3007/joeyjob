import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useSetPageMeta } from '@/lib/hooks/page-context'
import { toast } from 'sonner'
import { Save, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/settings')({
  component: OrganizationSettings,
})

function OrganizationSettings() {
  const { activeOrganization } = useActiveOrganization()
  const organization = activeOrganization

  const [formData, setFormData] = useState({
    name: organization?.name || '',
    slug: organization?.slug || ''
  })

  const [isLoading, setIsLoading] = useState(false)

  // Set page metadata
  useSetPageMeta({
    title: 'Workspace Settings'
  })

  const handleUpdateOrganization = async () => {
    if (!organization) return

    setIsLoading(true)
    try {
      const result = await authClient.organization.update({
        organizationId: organization.id,
        data: {
          name: formData.name,
          slug: formData.slug
        }
      })

      if (result.error) {
        toast.error(result.error.message || 'Failed to update organization')
      } else {
        toast.success('Organization updated successfully')
      }
    } catch (error) {
      toast.error('Failed to update organization')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteOrganization = async () => {
    if (!organization) return

    const confirmed = confirm(`Are you sure you want to delete "${organization.name}"? This action cannot be undone.`)
    if (!confirmed) return

    try {
      const result = await authClient.organization.delete({
        organizationId: organization.id
      })

      if (result.error) {
        toast.error(result.error.message || 'Failed to delete organization')
      } else {
        toast.success('Organization deleted')
        window.location.href = '/'
      }
    } catch (error) {
      toast.error('Failed to delete organization')
    }
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Organization not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto w-full">

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
            Organization Name
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder="Enter organization name"
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-foreground mb-2">
            Organization Slug
          </label>
          <input
            id="slug"
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder="organization-slug"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Used in URLs and API endpoints. Use lowercase letters, numbers, and hyphens only.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleUpdateOrganization}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6 mt-8">
        <h3 className="text-lg font-semibold text-red-800 mb-4">Danger Zone</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">Delete Organization</h4>
          <p className="text-sm text-red-700 mb-4">
            Once you delete an organization, there is no going back. This will permanently delete all todos, members, and data associated with this organization.
          </p>
          <button
            onClick={handleDeleteOrganization}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Delete Workspace
          </button>
        </div>
      </div>
    </div>
  )
}