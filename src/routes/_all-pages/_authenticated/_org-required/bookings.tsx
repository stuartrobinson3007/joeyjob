'use client'

import * as React from 'react'
import { useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { createFileRoute } from '@tanstack/react-router'
import { Calendar, User, FileText, Hash, Loader2, MapPin, ExternalLink, StickyNote } from 'lucide-react'

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
import { formatDate, formatTime, formatDateTime } from '@/taali/utils/date'
import { useLanguage } from '@/i18n/hooks/useLanguage'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/taali/errors/client-handler'
import { useQuery } from '@tanstack/react-query'
import { FormResponseViewer } from '@/components/form-response-viewer'
import { formatAddressOneLine, formatAddressMultiLine, getMapsLink, hasValidAddress } from '@/utils/maps'

interface Booking {
  id: string
  organizationId: string
  customerName: string
  customerEmail: string
  customerPhone: string | null
  customerAddress: string | null
  bookingStartAt: Date
  bookingEndAt: Date
  serviceDuration: number // This is the actual field name from server
  servicePrice: string | null // This is the actual field name from server
  status: string
  customerNotes: string | null
  internalNotes: string | null
  formResponses: unknown
  bookingSource: string
  confirmationCode: string
  createdAt: Date
  updatedAt: Date
  serviceName: string | null
  serviceDescription: string | null
}

export const Route = createFileRoute('/_all-pages/_authenticated/_org-required/bookings')({ 
  component: BookingsPage,
})

function BookingsPage() {
  const { activeOrganizationId, activeOrganization } = useActiveOrganization()
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
    const variants: Record<string, { variant: 'primary' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'muted', appearance: 'soft' | 'solid' }> = {
      pending: { variant: 'warning', appearance: 'soft' },
      confirmed: { variant: 'success', appearance: 'soft' },
      completed: { variant: 'info', appearance: 'soft' },
      cancelled: { variant: 'secondary', appearance: 'soft' },
      'no-show': { variant: 'destructive', appearance: 'soft' },
    }

    const config = variants[status] || { variant: 'secondary' as const, appearance: 'soft' as const }
    const label = status === 'no-show' ? t('status.noShow') : t(`status.${status}`)

    return (
      <Badge variant={config.variant} appearance={config.appearance}>
        {label}
      </Badge>
    )
  }

  const formatPrice = (price: string | number | null | undefined) => {
    // Handle null/undefined prices
    if (price === null || price === undefined) {
      return '-'
    }

    const numPrice = typeof price === 'string' ? parseFloat(price) : price

    if (isNaN(numPrice)) {
      return '-'
    }

    const locale = language === 'es' ? 'es-ES' : 'en-US'
    const currency = 'USD' // This could come from org settings
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(numPrice)
  }

  const formatDuration = (minutes: number) => {
    console.log('formatDuration input:', { minutes, type: typeof minutes, isNaN: isNaN(minutes) })
    
    if (isNaN(minutes) || minutes === null || minutes === undefined) {
      console.warn('Duration is invalid, returning fallback')
      return '0 minutes'
    }
    
    if (minutes < 60) {
      return t('duration.minutes', { count: minutes })
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    console.log('formatDuration calculated:', { hours, mins })
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
        console.log('Booking time data:', {
          booking: booking.id,
          startAt: booking.bookingStartAt,
          endAt: booking.bookingEndAt,
          serviceDuration: booking.serviceDuration,
          servicePrice: booking.servicePrice,
          timezone: activeOrganization?.timezone,
          startType: typeof booking.bookingStartAt,
          endType: typeof booking.bookingEndAt
        })
        
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {formatDate(booking.bookingStartAt, 'MMM d, yyyy', language, activeOrganization?.timezone)}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatTime(booking.bookingStartAt, 'h:mm a', activeOrganization?.timezone)} - {formatTime(booking.bookingEndAt, 'h:mm a', activeOrganization?.timezone)}
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
      accessorKey: 'customerAddress',
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          {t('fields.address')}
        </DataTableHeader>
      ),
      cell: ({ row }) => {
        const customerAddress = row.original.customerAddress
        if (!customerAddress) {
          return <span className="text-sm text-muted-foreground">{tCommon('messages.emptyValue')}</span>
        }

        // Get the original address object for maps link
        const address = row.original.formResponses?.address
        const mapsLink = getMapsLink(address, 'view')

        if (mapsLink) {
          return (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline max-w-[200px] block truncate"
              title={customerAddress}
            >
              {customerAddress}
            </a>
          )
        }

        return (
          <span className="text-sm max-w-[200px] block truncate" title={customerAddress}>
            {customerAddress}
          </span>
        )
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 200,
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
      accessorKey: 'serviceDuration',
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          {t('fields.duration')}
        </DataTableHeader>
      ),
      cell: ({ row }) => formatDuration(row.original.serviceDuration),
      enableColumnFilter: false,
      enableSorting: true,
      size: 100,
    },
    {
      accessorKey: 'servicePrice',
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          {t('fields.price')}
        </DataTableHeader>
      ),
      cell: ({ row }) => formatPrice(row.original.servicePrice),
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
                      <span className="text-sm text-muted-foreground">{t('details.labels.name')}</span>
                      <span className="text-sm font-medium">{selectedBooking.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t('details.labels.email')}</span>
                      <span className="text-sm font-medium">{selectedBooking.customerEmail}</span>
                    </div>
                    {selectedBooking.customerPhone && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('details.labels.phone')}</span>
                        <span className="text-sm font-medium">{selectedBooking.customerPhone}</span>
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
                      <span className="text-sm text-muted-foreground">{t('details.labels.date')}</span>
                      <span className="text-sm font-medium">
                        {formatDate(selectedBooking.bookingStartAt, 'MMMM d, yyyy', language, activeOrganization?.timezone)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t('details.labels.time')}</span>
                      <span className="text-sm font-medium">
                        {formatTime(selectedBooking.bookingStartAt, 'h:mm a', activeOrganization?.timezone)} - {formatTime(selectedBooking.bookingEndAt, 'h:mm a', activeOrganization?.timezone)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t('details.labels.duration')}</span>
                      <span className="text-sm font-medium">{formatDuration(selectedBooking.serviceDuration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t('details.labels.status')}</span>
                      {getStatusBadge(selectedBooking.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t('details.labels.price')}</span>
                      <span className="text-sm font-medium">{formatPrice(selectedBooking.servicePrice)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Address Information */}
                {hasValidAddress(selectedBooking.formResponses?.address) && (
                  <>
                    <div className="grid gap-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {t('details.address')}
                      </h3>
                      <div className="grid gap-3">
                        <div className="grid gap-1">
                          {formatAddressMultiLine(selectedBooking.formResponses.address).map((line, index) => (
                            <div key={index} className="text-sm">
                              {line}
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          {getMapsLink(selectedBooking.formResponses.address, 'view') && (
                            <a
                              href={getMapsLink(selectedBooking.formResponses.address, 'view')!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {t('details.openInMaps')}
                            </a>
                          )}
                          {getMapsLink(selectedBooking.formResponses.address, 'directions') && (
                            <a
                              href={getMapsLink(selectedBooking.formResponses.address, 'directions')!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {t('details.getDirections')}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Service Information */}
                {(selectedBooking.serviceName || selectedBooking.serviceDescription) && (
                  <>
                    <div className="grid gap-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {t('details.serviceInfo')}
                      </h3>
                      <div className="grid gap-3">
                        {selectedBooking.serviceName && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">{t('details.labels.service')}</span>
                            <span className="text-sm font-medium">{selectedBooking.serviceName}</span>
                          </div>
                        )}
                        {selectedBooking.serviceDescription && (
                          <div className="grid gap-1">
                            <span className="text-muted-foreground text-sm">{t('details.labels.description')}</span>
                            <p className="text-sm">{selectedBooking.serviceDescription}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Notes */}
                {(selectedBooking.customerNotes || selectedBooking.internalNotes) && (
                  <>
                    <div className="grid gap-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <StickyNote className="h-4 w-4" />
                        {t('fields.notes')}
                      </h3>
                      <div className="grid gap-3">
                        {selectedBooking.customerNotes && (
                          <div className="grid gap-1">
                            <span className="text-muted-foreground text-sm">{t('details.labels.customerNotes')}</span>
                            <p className="text-sm">{selectedBooking.customerNotes}</p>
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

                {/* Form Responses */}
                {selectedBooking.formResponses && (
                  <>
                    <div className="grid gap-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {t('details.formResponses')}
                      </h3>
                      <FormResponseViewer responses={selectedBooking.formResponses as any} />
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
                      <span className="text-sm text-muted-foreground">{t('details.labels.source')}</span>
                      <span className="text-sm font-medium capitalize">{selectedBooking.bookingSource}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t('details.labels.created')}</span>
                      <span className="text-sm font-medium">
                        {formatDateTime(selectedBooking.createdAt, 'MMM d, yyyy h:mm a', activeOrganization?.timezone)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t('details.labels.lastUpdated')}</span>
                      <span className="text-sm font-medium">
                        {formatDateTime(selectedBooking.updatedAt, 'MMM d, yyyy h:mm a', activeOrganization?.timezone)}
                      </span>
                    </div>
                    {selectedBooking.form && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('details.labels.form')}</span>
                        <span className="text-sm font-medium">{selectedBooking.form.name}</span>
                      </div>
                    )}
                    {selectedBooking.createdBy && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('details.labels.createdBy')}</span>
                        <span className="text-sm font-medium">{selectedBooking.createdBy.name}</span>
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