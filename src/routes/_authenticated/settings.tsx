import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useConfirm } from '@/ui/confirm-dialog'
import { organizationFormSchema, type OrganizationFormData } from '@/lib/validation/organization.schema'
import type { Organization } from '@/types/organization'
import {
  updateOrganizationWithValidation,
  deleteOrganizationWithValidation,
  checkSlugAvailability
} from '@/lib/auth/organization-wrapper'
import { useFormMutation } from '@/taali/hooks/use-form-mutation'
import { useAsyncFieldValidator } from '@/taali/hooks/use-async-field-validator'
import { useFormSync } from '@/taali/hooks/use-form-sync'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { clearActiveOrganizationId } from '@/features/organization/lib/organization-utils'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { useListOrganizations } from '@/lib/auth/auth-hooks'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'
import {
  FormErrorBoundary,
  Form,
  TextField,
  FormActions,
  FormRootError,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from '@/taali/components/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/taali/components/ui/select'
import { Button } from '@/ui/button'
import { Skeleton } from '@/ui/skeleton'
import { EmployeeManagement } from '@/features/organization/components/employee-management'

export const Route = createFileRoute('/_authenticated/settings')({
  component: OrganizationSettings,
})

function OrganizationSettingsForm() {
  const { activeOrganization, isLoading } = useActiveOrganization()
  const { refetch: refetchOrganizations } = useListOrganizations()
  const navigate = useNavigate()
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { t: tNotifications } = useTranslation('notifications')
  const { showSuccess } = useErrorHandler()
  const confirm = useConfirm()

  // Initialize form with React Hook Form and Zod
  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      timezone: 'America/New_York'
    },
    mode: 'onChange' // Enable real-time validation
  })

  // Sync form with loaded organization data
  useFormSync(form, activeOrganization ? {
    name: activeOrganization.name || '',
    slug: activeOrganization.slug || '',
    timezone: activeOrganization.timezone
  } : null, [activeOrganization])


  // Setup async slug validation
  const validateSlug = useAsyncFieldValidator(
    async (slug: string) => {
      // Skip validation if slug hasn't changed
      if (!activeOrganization || slug === activeOrganization.slug) {
        return true
      }

      // Skip if slug is empty (Zod will handle required validation)
      if (!slug) {
        return true
      }

      try {
        const result = await checkSlugAvailability({
          data: {
            slug,
            organizationId: activeOrganization.id
          }
        })

        return result.available || 'validation:organization.slug.taken'
      } catch (error) {
        // Handle abort errors gracefully
        if ((error as Error)?.name === 'AbortError') {
          return true // Return valid if aborted
        }

        // If validation fails, allow it (better to let server validate)
        // Slug validation error - handled by error state
        return true
      }
    },
    [activeOrganization]
  )

  // Setup mutation with error handling
  const updateMutation = useFormMutation<Organization, OrganizationFormData, OrganizationFormData>({
    mutationFn: async (data: OrganizationFormData) => {
      if (!activeOrganization) {
        throw new AppError(
          ERROR_CODES.VAL_REQUIRED_FIELD,
          400,
          { field: 'activeOrganization' },
          tCommon('organization.noActiveOrganization')
        )
      }
      return updateOrganizationWithValidation({
        ...data,
        organizationId: activeOrganization.id
      })
    },
    setError: form.setError,
    onSuccess: async () => {
      showSuccess(t('organization.updateSuccess'))
      // Refresh organizations list to update the sidebar
      await refetchOrganizations()
      // Mark form as clean after successful save
      form.reset(form.getValues())
    }
  })

  // Handle delete organization
  const handleDeleteOrganization = async () => {
    if (!activeOrganization) return

    const confirmed = await confirm({
      title: t('danger.deleteConfirmTitle'),
      description: t('danger.deleteConfirmWithName', { name: activeOrganization.name }),
      confirmText: t('danger.deleteWorkspace'),
      variant: 'destructive'
    })
    if (!confirmed) return

    try {
      await deleteOrganizationWithValidation(activeOrganization.id)
      toast.success(tNotifications('success.organizationDeleted'))

      // Clear the active organization from storage
      clearActiveOrganizationId()

      // Refresh organizations list to ensure deleted org doesn't appear
      await refetchOrganizations()

      // Navigate to organization selector
      navigate({ to: '/select-organization' })
    } catch (_error) {
      // Log and show error message for organization deletion failure
      // Failed to delete organization - handled by showError
      toast.error(tNotifications('error.organizationDeleteFailed'))
    }
  }

  const onSubmit = (data: OrganizationFormData) => {
    updateMutation.mutate(data)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title={t('title')} />
        <div className="flex-1 p-6">
          <div className="max-w-2xl mx-auto w-full">
            <div className="bg-card rounded-lg shadow-sm border p-6 space-y-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No organization state
  if (!activeOrganization) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title={t('title')} />
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t('organization.notFound')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={t('title')} />

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto w-full">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="bg-card rounded-lg shadow-sm border p-6 space-y-6">
              <TextField
                control={form.control}
                name="name"
                label={t('organization.name')}
                placeholder={t('organization.namePlaceholder')}
              />

              <TextField
                control={form.control}
                name="slug"
                label={t('organization.slug')}
                placeholder={t('organization.slugPlaceholder')}
                description={t('organization.slugHelp')}
                rules={{
                  validate: validateSlug
                }}
              />
              {/* 
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="America/Phoenix">Arizona Time (MST)</SelectItem>
                        <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                        <SelectItem value="Pacific/Honolulu">Hawaii Time (HST)</SelectItem>
                        <SelectItem value="America/Toronto">Toronto (ET)</SelectItem>
                        <SelectItem value="America/Vancouver">Vancouver (PT)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT)</SelectItem>
                        <SelectItem value="Europe/Berlin">Berlin (CET)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                        <SelectItem value="Australia/Sydney">Sydney (AEDT)</SelectItem>
                        <SelectItem value="Australia/Melbourne">Melbourne (AEDT)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => {
                  console.log('field', field)
                  return (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a verified email to display" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                          <SelectItem value="Australia/Sydney">Sydney (AEDT)</SelectItem>
                          <SelectItem value="Australia/Melbourne">Melbourne (AEDT)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />

              {/* Root-level errors */}
              <FormRootError errors={form.formState.errors} />

              {/* Form actions */}
              <FormActions
                isSubmitting={updateMutation.isPending}
                isDirty={form.formState.isDirty}
                submitLabel={tCommon('actions.save')}
                showCancel={false}
              />
            </form>
          </Form>

          {/* Employee Management */}
          <EmployeeManagement />

          {/* Danger Zone */}
          <div className="bg-card rounded-lg shadow-sm border border-destructive/30 p-6 mt-8">
            <h3 className="text-lg font-semibold text-destructive mb-4">{t('danger.title')}</h3>
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
              <h4 className="font-medium text-destructive mb-2">{t('danger.delete')}</h4>
              <p className="text-sm text-destructive/90 mb-4">{t('danger.deleteWarning')}</p>
              <Button
                onClick={handleDeleteOrganization}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 />
                {t('danger.deleteWorkspace')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Export with error boundary wrapper
function OrganizationSettings() {
  return (
    <FormErrorBoundary>
      <OrganizationSettingsForm />
    </FormErrorBoundary>
  )
}