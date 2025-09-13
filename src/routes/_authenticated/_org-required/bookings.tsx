'use client'

import * as React from 'react'
import { useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { createFileRoute } from '@tanstack/react-router'
import { Calendar, User, FileText, Hash, Loader2 } from 'lucide-react'

import { getBookingsTable, getBooking } from '@/features/booking/lib/bookings.server'
import { bookingKeys } from '@/features/booking/lib/query-keys'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { PageHeader } from '@/components/page-header'
import { DataTable, DataTableHeader } from '@/taali/components/data-table'
import { useTableQuery } from '@/taali/components/data-table'
import {
  DataTableConfig,
  DataTableColumnMeta,
  ServerQueryParams,
} from '@/taali/components/data-table'
import { Badge } from '@/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/ui/sheet'
import { Separator } from '@/ui/separator'
import { ScrollArea } from '@/ui/scroll-area'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useLanguage } from '@/i18n/hooks/useLanguage'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/taali/errors/client-handler'
import { useQuery } from '@tanstack/react-query'
import { formatInTimezone } from '@/taali/utils/date'

interface Booking {
  id: string
  organizationId: string
  customerName: string
  customerEmail: string
  customerPhone: string | null
  bookingStartAt: Date
  bookingEndAt: Date
  duration: number
  price: string
  status: string
  notes: string | null
  internalNotes: string | null
  formData: unknown
  source: string
  confirmationCode: string
  createdAt: Date
  updatedAt: Date
  serviceName: string | null
  servicePrice: string | null
  formName: string | null
}

export const Route = createFileRoute('/_authenticated/_org-required/bookings')({ 
  component: BookingsPage,
})

function BookingsPage() {
  const { activeOrganizationId } = useActiveOrganization()
  const { t } = useTranslation('bookings')
  const { t: tCommon } = useTranslation('common')
  const { language } = useLanguage()

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [currentFilters, setCurrentFilters] = React.useState<ServerQueryParams>({})

  // Use the table query hook
  const { data, totalCount, isLoading, isFetching, isError, error, onStateChange, refetch } = useTableQuery<Booking>({
    queryKey: activeOrganizationId ? [...bookingKeys.tables(activeOrganizationId)] : [],
    queryFn: (params?: ServerQueryParams) => {
      const queryParams = params || {}
      setCurrentFilters(queryParams)
      return getBookingsTable({ data: queryParams })
    },
    enabled: !!activeOrganizationId,
  })

  // Query for selected booking details
  const { data: selectedBooking, isLoading: isLoadingDetail } = useQuery({
    queryKey: selectedBookingId && activeOrganizationId
      ? bookingKeys.detail(activeOrganizationId, selectedBookingId)
      : [],
    queryFn: () => selectedBookingId ? getBooking({ data: { id: selectedBookingId } }) : null,
    enabled: !!selectedBookingId && !!activeOrganizationId && isSheetOpen,
  })

  const handleRowClick = React.useCallback((booking: Booking) => {
    setSelectedBookingId(booking.id)
    setIsSheetOpen(true)
  }, [])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', className: string }> = {
      pending: { variant: 'outline', className: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
      confirmed: { variant: 'outline', className: 'border-green-200 bg-green-50 text-green-700' },
      completed: { variant: 'outline', className: 'border-blue-200 bg-blue-50 text-blue-700' },
      cancelled: { variant: 'outline', className: 'border-gray-200 bg-gray-50 text-gray-700' },
      'no-show': { variant: 'outline', className: 'border-red-200 bg-red-50 text-red-700' },
    }

    const config = variants[status] || { variant: 'outline' as const, className: '' }
    const label = status === 'no-show' ? t('status.noShow') : t(`status.${status}`)

    return (
      <Badge variant={config.variant} className={config.className}>
        {label}
      </Badge>
    )
  }

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price
    const locale = language === 'es' ? 'es-ES' : 'en-US'
    const currency = 'USD' // This could come from org settings
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(numPrice)
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return t('duration.minutes', { count: minutes })
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return t('duration.hours', { hours, minutes: mins })
  }

  const columns: ColumnDef<Booking>[] = useMemo(() => [
    {
      accessorKey: 'bookingStartAt',
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          {t('fields.dateTime')}
        </DataTableHeader>
      ),
      cell: ({ row }) => {
        const booking = row.original
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              }).format(new Date(booking.bookingStartAt))}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatInTimezone(booking.bookingStartAt, organization?.timezone || 'America/New_York', 'h:mm a')} - {formatInTimezone(booking.bookingEndAt, organization?.timezone || 'America/New_York', 'h:mm a')}
            </span>
          </div>
        )
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
      meta: {
        filterConfig: {
          type: 'dateRange',
          title: t('fields.date'),
        },
      } as DataTableColumnMeta,
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          {t('fields.customerName')}
        </DataTableHeader>
      ),
      cell: ({ row }) => {
        const booking = row.original
        return (
          <div className="flex flex-col">
            <span className="font-medium">{booking.customerName}</span>
            {booking.customerEmail && (
              <span className="text-sm text-muted-foreground">{booking.customerEmail}</span>
            )}
          </div>
        )
      },
      enableColumnFilter: false,
      enableSorting: true,
      size: 200,
    },
    {
      accessorKey: 'customerPhone',
      header: ({ column }) => (
        <DataTableHeader column={column}>
          {t('fields.phone')}
        </DataTableHeader>
      ),
      cell: ({ row }) => row.original.customerPhone || tCommon('messages.emptyValue'),
      enableColumnFilter: false,
      enableSorting: false,
      size: 120,
    },
    {
      accessorKey: 'serviceName',
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          {t('fields.service')}
        </DataTableHeader>
      ),
      cell: ({ row }) => row.original.serviceName || tCommon('messages.emptyValue'),
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          {t('fields.status')}
        </DataTableHeader>
      ),
      cell: ({ row }) => getStatusBadge(row.original.status),
      enableColumnFilter: true,
      enableSorting: true,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
      size: 120,
      meta: {
        filterConfig: {
          type: 'select',
          title: t('filters.status'),
          options: [
            { label: t('status.pending'), value: 'pending' },
            { label: t('status.confirmed'), value: 'confirmed' },
            { label: t('status.completed'), value: 'completed' },
            { label: t('status.cancelled'), value: 'cancelled' },
            { label: t('status.noShow'), value: 'no-show' },
          ],
        },
      } as DataTableColumnMeta,
    },
    {
      accessorKey: 'duration',
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          {t('fields.duration')}
        </DataTableHeader>
      ),
      cell: ({ row }) => formatDuration(row.original.duration),
      enableColumnFilter: false,
      enableSorting: true,
      size: 100,
    },
    {
      accessorKey: 'price',
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          {t('fields.price')}
        </DataTableHeader>
      ),
      cell: ({ row }) => formatPrice(row.original.price),
      enableColumnFilter: false,
      size: 100,
    },
  ], [t, tCommon, language, formatPrice, formatDuration])

  const tableConfig = React.useMemo<DataTableConfig<Booking>>(
    () => ({
      searchConfig: {
        placeholder: t('filters.search'),
      },
      paginationConfig: {
        pageSizeOptions: [10, 20, 30, 50],
        defaultPageSize: 10,
      },
      enableColumnFilters: true,
      enableRowSelection: false,
      enableSorting: true,
      manualFiltering: true,
      manualPagination: true,
      manualSorting: true,
      onRowClick: handleRowClick,
    }),
    [t, handleRowClick]
  )

  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">{tCommon('errors.noOrganization')}</h2>
        <p className="text-muted-foreground">{tCommon('errors.noOrganizationDescription')}</p>
      </div>
    )
  }

  if (isError && error) {
    return <ErrorState error={parseError(error)} onRetry={refetch} />
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={t('title')} />

      <div className="flex-1 p-6">
        <DataTable
          columns={columns}
          data={data || []}
          config={tableConfig}
          totalCount={totalCount}
          isLoading={isLoading}
          isFetching={isFetching}
          onStateChange={onStateChange}
          currentFilters={currentFilters}
          onRowClick={handleRowClick}
          getRowIdProp={row => row.id}
          resetText={tCommon('actions.reset')}
          noResultsText={tCommon('messages.noResults')}
          className="h-[600px]"
        />
      </div>

      {/* Booking Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col gap-0">
          <SheetHeader className="border-b">
            <SheetTitle>{t('details.title')}</SheetTitle>
            <SheetDescription>
              {selectedBooking?.confirmationCode && (
                <span className="font-mono text-sm">#{selectedBooking.confirmationCode}</span>
              )}
            </SheetDescription>
          </SheetHeader>

          {isLoadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : selectedBooking ? (
            <ScrollArea className="flex-1 h-0">
              <div className="grid auto-rows-min gap-6 p-6">
                {/* Customer Information */}
                <div className="grid gap-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t('details.customerInfo')}
                  </h3>
                  <div className="grid gap-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.labels.name')}</span>
                      <span className="font-medium">{selectedBooking.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.labels.email')}</span>
                      <span className="font-medium">{selectedBooking.customerEmail}</span>
                    </div>
                    {selectedBooking.customerPhone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('details.labels.phone')}</span>
                        <span className="font-medium">{selectedBooking.customerPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Booking Information */}
                <div className="grid gap-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('details.bookingInfo')}
                  </h3>
                  <div className="grid gap-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.labels.date')}</span>
                      <span className="font-medium">
                        {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        }).format(new Date(selectedBooking.bookingStartAt))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.labels.time')}</span>
                      <span className="font-medium">
                        {formatInTimezone(selectedBooking.bookingStartAt, organization?.timezone || 'America/New_York', 'h:mm a')} - {formatInTimezone(selectedBooking.bookingEndAt, organization?.timezone || 'America/New_York', 'h:mm a')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.labels.duration')}</span>
                      <span className="font-medium">{formatDuration(selectedBooking.duration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.labels.status')}</span>
                      {getStatusBadge(selectedBooking.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.labels.price')}</span>
                      <span className="font-medium">{formatPrice(selectedBooking.price)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Service Information */}
                {selectedBooking.service && (
                  <>
                    <div className="grid gap-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {t('details.serviceInfo')}
                      </h3>
                      <div className="grid gap-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('details.labels.service')}</span>
                          <span className="font-medium">{selectedBooking.service.name}</span>
                        </div>
                        {selectedBooking.service.description && (
                          <div className="grid gap-1">
                            <span className="text-muted-foreground text-sm">{t('details.labels.description')}</span>
                            <p className="text-sm">{selectedBooking.service.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Notes */}
                {(selectedBooking.notes || selectedBooking.internalNotes) && (
                  <>
                    <div className="grid gap-3">
                      <h3 className="font-semibold">{t('fields.notes')}</h3>
                      <div className="grid gap-3">
                        {selectedBooking.notes && (
                          <div className="grid gap-1">
                            <span className="text-muted-foreground text-sm">{t('details.labels.customerNotes')}</span>
                            <p className="text-sm">{selectedBooking.notes}</p>
                          </div>
                        )}
                        {selectedBooking.internalNotes && (
                          <div className="grid gap-1">
                            <span className="text-muted-foreground text-sm">{t('details.labels.internalNotes')}</span>
                            <p className="text-sm">{selectedBooking.internalNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Form Data */}
                {selectedBooking.formData && (
                  <>
                    <div className="grid gap-3">
                      <h3 className="font-semibold">{t('details.formData')}</h3>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(selectedBooking.formData, null, 2)}
                        </pre>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Metadata */}
                <div className="grid gap-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    {t('details.metadata')}
                  </h3>
                  <div className="grid gap-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.labels.source')}</span>
                      <span className="font-medium capitalize">{selectedBooking.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.labels.created')}</span>
                      <span className="font-medium">
                        {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        }).format(new Date(selectedBooking.createdAt))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('details.labels.lastUpdated')}</span>
                      <span className="font-medium">
                        {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        }).format(new Date(selectedBooking.updatedAt))}
                      </span>
                    </div>
                    {selectedBooking.form && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('details.labels.form')}</span>
                        <span className="font-medium">{selectedBooking.form.name}</span>
                      </div>
                    )}
                    {selectedBooking.createdBy && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('details.labels.createdBy')}</span>
                        <span className="font-medium">{selectedBooking.createdBy.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}