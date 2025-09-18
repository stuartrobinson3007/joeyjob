import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus, FileText, Edit, Trash2, Copy, Eye, Code } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getBookingForms, createForm, deleteForm, duplicateForm, undoDeleteForm } from '@/features/booking/lib/forms.server'
import { useErrorHandler } from '@/lib/errors/hooks'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { formatDate } from '@/taali/utils/date'
import { useLoadingItems } from '@/taali/hooks/use-loading-state'
import { useConfirm } from '@/ui/confirm-dialog'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Badge } from '@/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { PageHeader } from '@/components/page-header'
import { EmbedDialog } from '@/features/booking/components/embed-dialog'

export const Route = createFileRoute('/_all-pages/_authenticated/_org-required/')({
  component: FormsPage,
})

function FormsPage() {
  const { activeOrganizationId, activeOrganization } = useActiveOrganization()
  const navigate = useNavigate()
  const { showError, showSuccess } = useErrorHandler()
  const confirm = useConfirm()
  const [isCreating, setIsCreating] = useState(false)
  const [embedDialog, setEmbedDialog] = useState<{ open: boolean; formId: string; formName: string; formSlug?: string }>({
    open: false,
    formId: '',
    formName: '',
    formSlug: ''
  })

  // Loading states for individual form actions
  const {
    isLoading: isLoadingForm,
    startLoading: startFormLoading,
    stopLoading: stopFormLoading,
    loadingItems: loadingForms,
  } = useLoadingItems<string>()

  // Fetch forms data using React Query
  const { data: formsData, isLoading, refetch } = useQuery({
    queryKey: ['forms', activeOrganizationId],
    queryFn: () => getBookingForms({ 
      data: { 
        limit: 50,
        offset: 0 
      } 
    }),
    enabled: !!activeOrganizationId,
  })

  const forms = formsData?.forms || []
  const services = [] // Services will be implemented later

  const getServiceName = (serviceId: string | null) => {
    if (!serviceId) return 'All Services'
    const service = services.find(s => s.id === serviceId)
    return service?.name || 'Unknown Service'
  }

  const handleEmbedForm = (formId: string, formName: string, formSlug?: string) => {
    setEmbedDialog({ open: true, formId, formName, formSlug })
  }

  const handleDelete = async (formId: string, formName: string) => {
    const confirmed = await confirm({
      title: 'Delete Form',
      description: `Are you sure you want to delete "${formName}"? This action can be undone.`,
      confirmText: 'Delete',
      variant: 'destructive'
    })
    if (!confirmed) return

    startFormLoading(formId)
    try {
      await deleteForm({ data: { id: formId } })
      refetch()

      // Show success toast with undo action
      showSuccess('Form deleted successfully', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await undoDeleteForm({ data: { id: formId } })
              refetch()
              showSuccess('Form restored successfully')
            } catch (error) {
              showError(error)
            }
          }
        }
      })
    } catch (error) {
      showError(error)
    } finally {
      stopFormLoading(formId)
    }
  }

  const handleDuplicate = async (formId: string, formName: string) => {
    startFormLoading(formId)
    try {
      const duplicated = await duplicateForm({ data: { id: formId } })
      refetch()
      showSuccess('Form duplicated successfully')
      
      // Navigate to edit the duplicated form
      navigate({ to: '/form/$formId/edit', params: { formId: duplicated.id } })
    } catch (error) {
      showError(error)
    } finally {
      stopFormLoading(formId)
    }
  }

  // Handle immediate form creation
  const handleCreateForm = async () => {
    setIsCreating(true)
    try {
      const formData = {
        name: 'Untitled Form',
        description: '',
      }
      console.log('📝 Client calling createForm with:', formData)

      const created = await createForm({ data: formData })

      showSuccess('Form created')
      console.log('📝 Attempting navigation to:', `/form/${created.id}/edit`)
      
      // Refetch forms list after creation
      refetch()

      navigate({ to: '/form/$formId/edit', params: { formId: created.id } })
    } catch (error) {
      showError(error)
      setIsCreating(false)
    }
  }

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Forms" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Forms"
        actions={
          <Button onClick={handleCreateForm} disabled={isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? 'Creating...' : 'Create Form'}
          </Button>
        }
      />
      <div className="flex-1 p-6">
        {forms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map(({ form }) => {
              const isLoading = isLoadingForm(form.id)
              return (
              <Card key={form.id} className={`group hover:shadow-md transition-shadow ${isLoading ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base line-clamp-2">
                        {form.name}
                      </CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          disabled={isLoading}
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                            />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          const hostedUrl = activeOrganization?.slug && form.slug
                            ? `/f/${activeOrganization.slug}/${form.slug}`
                            : `/book/${form.id}`
                          window.open(hostedUrl, '_blank')
                        }}>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <Link to="/form/$formId/edit" params={{ formId: form.id }}>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem onClick={() => handleEmbedForm(form.id, form.name, form.slug)} disabled={isLoading}>
                          <Code className="h-4 w-4 mr-2" />
                          Embed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(form.id, form.name)} disabled={isLoading}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(form.id, form.name)} disabled={isLoading}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={form.isActive ? "success" : "secondary"} className="text-xs">
                        {form.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {form.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {Array.isArray(form.fields) ? form.fields.length : 0} fields
                      </Badge>
                    </div>

                    {/* Service Info */}
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Service:</span>{' '}
                      {getServiceName(form.serviceId)}
                    </div>

                    {/* Last Modified */}
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDate(form.updatedAt, 'MMM d, yyyy', undefined, activeOrganization?.timezone)}
                    </div>

                    {/* Hosted URL */}
                    {activeOrganization?.slug && form.slug && (
                      <div className="text-xs">
                        <span className="font-medium text-foreground">Hosted at:</span>{' '}
                        <span className="font-mono text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/f/${activeOrganization.slug}/${form.slug}`)}>
                          /f/{activeOrganization.slug}/{form.slug}
                        </span>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-2">
                      <Link to="/form/$formId/edit" params={{ formId: form.id }} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const hostedUrl = activeOrganization?.slug && form.slug
                            ? `/f/${activeOrganization.slug}/${form.slug}`
                            : `/book/${form.id}`
                          window.open(hostedUrl, '_blank')
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No forms created yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Create your first booking form to get started collecting customer information
            </p>
            <Button onClick={handleCreateForm} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : 'Create Your First Form'}
            </Button>
          </div>
        )}
      </div>

      {/* Embed Dialog */}
      <EmbedDialog
        open={embedDialog.open}
        onOpenChange={(open) => setEmbedDialog(prev => ({ ...prev, open }))}
        formId={embedDialog.formId}
        formName={embedDialog.formName}
        orgSlug={activeOrganization?.slug}
        formSlug={embedDialog.formSlug}
      />
    </div>
  )
}