import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'

import { useErrorHandler } from '@/lib/errors/hooks'
import { getForm, updateForm, deleteForm } from '@/features/booking/lib/forms.server'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useResourceQuery } from '@/taali/hooks/use-resource-query'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/taali/errors/client-handler'
import { Button } from '@/ui/button'
import { ScrollArea } from '@/ui/scroll-area'

// Type definitions (copied and adapted from joeyjob-old)
export interface FlowNode {
  id: string
  type: 'start' | 'split' | 'service'
  label: string
  children?: FlowNode[]
  description?: string
  price?: string
  duration?: number
  additionalQuestions?: FormFieldConfig[]
  // Add other properties as needed
}

export interface FormFieldConfig {
  id: string
  name: string
  label: string
  type: string
  isRequired?: boolean
  options?: Array<{ value: string; label: string }>
  fieldConfig?: any
}

export interface BookingFlowData {
  id: string
  internalName: string
  serviceTree: FlowNode
  baseQuestions: FormFieldConfig[]
  theme: 'light' | 'dark'
  primaryColor: string
}

export const Route = createFileRoute('/_authenticated/form/$formId/edit')({
  component: FormEditorPage,
  staticData: {
    sidebar: false, // Hide sidebar for full-screen form editor
  },
})

/**
 * Generates the initial form data structure
 */
const generateInitialFormData = (formName: string, formConfig?: any): BookingFlowData => {
  // Create default contact info field
  const contactInfoField: FormFieldConfig = {
    id: 'contact-info-field',
    name: 'contact_info',
    label: 'Contact Information',
    type: 'contact-info',
    fieldConfig: {
      firstNameRequired: true,
      lastNameRequired: true,
      emailRequired: true,
      phoneRequired: true,
      companyRequired: false
    }
  }

  // Use existing formConfig if available, otherwise create defaults
  if (formConfig && formConfig.serviceTree && formConfig.baseQuestions) {
    return {
      id: `form-${Date.now()}`,
      internalName: formName,
      serviceTree: formConfig.serviceTree,
      baseQuestions: formConfig.baseQuestions,
      theme: formConfig.theme || 'light',
      primaryColor: formConfig.primaryColor || '#3B82F6'
    }
  }

  return {
    id: `form-${Date.now()}`,
    internalName: formName,
    serviceTree: {
      id: 'root',
      type: 'start',
      label: 'Book your service',
      children: []
    },
    baseQuestions: [contactInfoField],
    theme: 'light' as const,
    primaryColor: '#3B82F6'
  }
}

function FormEditorPage() {
  const { formId } = Route.useParams()
  const navigate = useNavigate()
  const { activeOrganizationId } = useActiveOrganization()
  const { showError, showSuccess } = useErrorHandler()

  // Load form using resource query
  const { data: form, isLoading, isError, error, refetch } = useResourceQuery({
    queryKey: ['form', activeOrganizationId, formId],
    queryFn: () => getForm({ data: { id: formId } }),
    enabled: !!formId && !!activeOrganizationId,
    redirectOnError: '/forms'
  })

  // Initialize form data from loaded form
  const formData = useMemo(() => {
    if (!form) return null
    return generateInitialFormData(form.name, form.formConfig)
  }, [form])

  // Auto-save functionality
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedDataRef = useRef<string>('')
  const isInitializedRef = useRef<boolean>(false)

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (!form || !formData) return

    const currentDataString = JSON.stringify({
      name: formData.internalName,
      form_config: {
        baseQuestions: formData.baseQuestions,
        serviceTree: formData.serviceTree,
        theme: formData.theme,
        primaryColor: formData.primaryColor
      }
    })

    // Only save if data has actually changed
    if (currentDataString !== lastSavedDataRef.current) {
      try {
        await updateForm({
          data: {
            id: form.id,
            name: formData.internalName,
            formConfig: {
              baseQuestions: formData.baseQuestions,
              serviceTree: formData.serviceTree,
              theme: formData.theme,
              primaryColor: formData.primaryColor
            }
          }
        })
        lastSavedDataRef.current = currentDataString
        console.log('✅ Form auto-saved')
      } catch (error) {
        console.error('❌ Auto-save failed:', error)
        showError('Failed to save form changes')
      }
    }
  }, [form, formData, updateForm, showError])

  // Debounced auto-save effect
  useEffect(() => {
    if (!form || !formData) return

    const currentDataString = JSON.stringify({
      name: formData.internalName,
      form_config: {
        baseQuestions: formData.baseQuestions,
        serviceTree: formData.serviceTree,
        theme: formData.theme,
        primaryColor: formData.primaryColor
      }
    })

    // Skip on initial load
    if (!isInitializedRef.current) {
      lastSavedDataRef.current = currentDataString
      isInitializedRef.current = true
      return
    }

    // Only save if data changed
    if (currentDataString !== lastSavedDataRef.current) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }

      // Set new timeout (2 seconds)
      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSave()
      }, 2000)
    }

    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [formData, autoSave, form])

  // Create form methods for preview
  const formMethods = useForm({
    defaultValues: {
      contact_info: {
        firstName: "",
        lastName: "",
        email: "",
        phone: ""
      }
    }
  })

  // Common navigation handlers
  const handleExit = () => {
    navigate({ to: "/forms" })
  }

  const handleDelete = async () => {
    if (!form) return
    
    try {
      await deleteForm({ data: { id: form.id } })
      showSuccess('Form deleted')
      navigate({ to: '/forms' })
    } catch (error) {
      showError(error)
    }
  }

  // Loading and error states
  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">No Organization</h2>
        <p className="text-muted-foreground">Please select an organization to continue.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (isError && error) {
    return <ErrorState error={parseError(error)} onRetry={refetch} />
  }

  if (!form || !formData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">Form Not Found</h2>
        <p className="text-muted-foreground mb-4">The form you're looking for doesn't exist.</p>
        <Button onClick={() => navigate({ to: '/forms' })}>Back to Forms</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleExit}>
            ← Back to Forms
          </Button>
          <h1 className="text-lg font-semibold">{formData.internalName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Preview
          </Button>
          <Button variant="outline" size="sm">
            Share
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {/* Main content - Multi-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Form builder */}
        <div className="w-1/2 flex flex-col overflow-hidden border-r">
          <div className="p-4 border-b bg-muted/50">
            <h2 className="font-medium">Form Builder</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-6">
              {/* Service Tree Section */}
              <div className="space-y-4 mb-8">
                <h3 className="text-sm font-medium text-muted-foreground">SERVICE TREE</h3>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <p className="text-muted-foreground">Service tree will go here</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Drag and drop to organize your services
                  </p>
                </div>
              </div>

              {/* Form Fields Section */}
              <div className="space-y-4 mb-8">
                <h3 className="text-sm font-medium text-muted-foreground">BASE QUESTIONS</h3>
                <div className="space-y-3">
                  {formData.baseQuestions.map((question, index) => (
                    <div key={question.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{question.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {question.type} • {question.isRequired ? 'Required' : 'Optional'}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full">
                  + Add Question
                </Button>
              </div>

              {/* Branding Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">BRANDING</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Theme</label>
                    <div className="flex gap-2 mt-1">
                      <Button 
                        variant={formData.theme === 'light' ? 'default' : 'outline'} 
                        size="sm"
                      >
                        Light
                      </Button>
                      <Button 
                        variant={formData.theme === 'dark' ? 'default' : 'outline'} 
                        size="sm"
                      >
                        Dark
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Primary Color</label>
                    <div className="flex items-center gap-2 mt-1">
                      <div 
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: formData.primaryColor }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.primaryColor}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right panel - Live preview */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-muted/50">
            <h2 className="font-medium">Live Preview</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-6">
              <div className="border rounded-lg p-8 bg-card">
                <h2 className="text-xl font-semibold mb-4">{formData.serviceTree.label}</h2>
                <p className="text-muted-foreground mb-6">
                  This is a live preview of your booking form
                </p>
                
                {/* Preview of base questions */}
                <div className="space-y-4">
                  {formData.baseQuestions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <label className="text-sm font-medium">
                        {question.label}
                        {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {question.type === 'contact-info' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <input 
                              type="text" 
                              placeholder="First Name" 
                              className="w-full px-3 py-2 border rounded-md"
                              disabled
                            />
                          </div>
                          <div>
                            <input 
                              type="text" 
                              placeholder="Last Name" 
                              className="w-full px-3 py-2 border rounded-md"
                              disabled
                            />
                          </div>
                          <div>
                            <input 
                              type="email" 
                              placeholder="Email" 
                              className="w-full px-3 py-2 border rounded-md"
                              disabled
                            />
                          </div>
                          <div>
                            <input 
                              type="tel" 
                              placeholder="Phone" 
                              className="w-full px-3 py-2 border rounded-md"
                              disabled
                            />
                          </div>
                        </div>
                      ) : (
                        <input 
                          type="text" 
                          placeholder={question.label} 
                          className="w-full px-3 py-2 border rounded-md"
                          disabled
                        />
                      )}
                    </div>
                  ))}
                </div>

                <Button className="w-full mt-6" disabled>
                  Book Service
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}