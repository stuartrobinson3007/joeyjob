import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus, FileText, Edit, Trash2, Copy, Eye } from 'lucide-react'
import { useState } from 'react'

import { getBookingForms, createForm } from '@/features/booking/lib/forms.server'
import { useErrorHandler } from '@/lib/errors/hooks'
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

export const Route = createFileRoute('/_authenticated/forms')({
  component: FormsPage,
  loader: async () => {
    try {
      const formsData = await getBookingForms({ limit: 50 })

      return {
        forms: formsData.forms,
        services: [], // Services will be implemented later
        pagination: formsData.pagination,
      }
    } catch (error) {
      console.error('Failed to load forms:', error)
      return {
        forms: [],
        services: [],
        pagination: { limit: 50, offset: 0, total: 0, hasMore: false },
      }
    }
  },
})

function FormsPage() {
  const { forms, services } = Route.useLoaderData()
  const navigate = useNavigate()
  const { showError, showSuccess } = useErrorHandler()
  const [isCreating, setIsCreating] = useState(false)

  const getServiceName = (serviceId: string | null) => {
    if (!serviceId) return 'All Services'
    const service = services.find(s => s.id === serviceId)
    return service?.name || 'Unknown Service'
  }

  // Handle immediate form creation (like createTodo pattern)
  const handleCreateForm = async () => {
    setIsCreating(true)
    try {
      const formData = {
        name: 'Untitled Form',
        description: '',
      }
      console.log('📝 Client calling createForm with:', formData)

      const created = await createForm(formData)

      showSuccess('Form created')
      console.log('📝 Attempting navigation to:', `/form/${created.id}/edit`)

      navigate({ to: '/form/$formId/edit', params: { formId: created.id } })
    } catch (error) {
      showError(error)
      setIsCreating(false)
    }
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
            {forms.map(({ form }) => (
              <Card key={form.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base line-clamp-2">
                        {form.name}
                      </CardTitle>
                      {form.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {form.description}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
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
                        <Link to="/book/$formId" params={{ formId: form.id }}>
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                        </Link>
                        <Link to="/form/$formId/edit" params={{ formId: form.id }}>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
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
                      Updated {new Date(form.updatedAt).toLocaleDateString()}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-2">
                      <Link to="/form/$formId/edit" params={{ formId: form.id }} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </Link>
                      <Link to="/book/$formId" params={{ formId: form.id }}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
    </div>
  )
}