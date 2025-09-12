import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql, desc, asc, or, gte, lte, ilike } from 'drizzle-orm'
import { z } from 'zod'
import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { db } from '@/lib/db/db'
import { bookings, services, bookingForms, user } from '@/database/schema'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'
import { validateServerQueryParams } from '@/lib/utils/server-query-schemas'
import {
  buildColumnFilter,
  buildSearchFilter,
  parseFilterValue,
  preprocessFilterValue,
} from '@/taali/utils/table-filters'
import { ServerQueryResponse } from '@/taali/components/data-table'

// Get bookings table with pagination and filters
export const getBookingsTable = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(validateServerQueryParams)
  .handler(async ({ data, context }) => {
    const { organizationId } = context
    
    if (!organizationId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        undefined,
        'Organization context required'
      )
    }
    
    // Data is now properly validated and has defaults applied
    const { search, filters, sorting, pagination } = data
    
    try {
      // Build where conditions
      const conditions: SQL[] = [eq(bookings.organizationId, organizationId)]
      
      // Add search filter
      if (search) {
        conditions.push(
          or(
            ilike(bookings.customerName, `%${search}%`),
            ilike(bookings.customerEmail, `%${search}%`),
            ilike(bookings.customerPhone, `%${search}%`),
            ilike(bookings.confirmationCode, `%${search}%`)
          )!
        )
      }
      
      // Add column filters
      Object.entries(filters).forEach(([columnId, value]) => {
        if (value === undefined || value === null) return
        
        // Parse the filter value to get operator and actual value
        const { operator, value: filterValue } = parseFilterValue(value)
        
        // Map column IDs to database columns
        const columnMap: Record<string, PgColumn> = {
          bookingStartAt: bookings.bookingStartAt,
          customerName: bookings.customerName,
          status: bookings.status,
          serviceName: services.name,
          price: bookings.price,
        }
        
        const column = columnMap[columnId]
        if (column) {
          const processedValue = preprocessFilterValue(columnId, filterValue)
          
          const filter = buildColumnFilter({
            column,
            operator,
            value: processedValue,
          })
          if (filter) conditions.push(filter)
        }
      })
      
      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(bookings)
        .where(and(...conditions))
      
      const totalCount = Number(countResult[0]?.count || 0)
      
      // Build order by
      const orderBy =
        sorting.length > 0
          ? sorting
              .map((sort: { id: string; desc?: boolean }) => {
                const columnMap: Record<string, PgColumn> = {
                  bookingStartAt: bookings.bookingStartAt,
                  customerName: bookings.customerName,
                  status: bookings.status,
                  duration: bookings.duration,
                  price: bookings.price,
                  serviceName: services.name,
                }
                const column = columnMap[sort.id]
                return column ? (sort.desc ? desc(column) : asc(column)) : null
              })
              .filter(Boolean)
          : [desc(bookings.bookingStartAt)]
      
      // Get bookings with joins
      const bookingsData = await db
        .select({
          booking: bookings,
          service: services,
          form: bookingForms,
        })
        .from(bookings)
        .leftJoin(services, eq(bookings.serviceId, services.id))
        .leftJoin(bookingForms, eq(bookings.formId, bookingForms.id))
        .where(and(...conditions))
        .orderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy]))
        .limit(pagination.pageSize)
        .offset(pagination.pageIndex * pagination.pageSize)
      
      // Format the data
      const formattedData = bookingsData.map(row => ({
        id: row.booking.id,
        organizationId: row.booking.organizationId,
        customerName: row.booking.customerName,
        customerEmail: row.booking.customerEmail,
        customerPhone: row.booking.customerPhone,
        bookingStartAt: row.booking.bookingStartAt,
        bookingEndAt: row.booking.bookingEndAt,
        duration: row.booking.duration,
        price: row.booking.price,
        status: row.booking.status,
        notes: row.booking.notes,
        internalNotes: row.booking.internalNotes,
        formData: row.booking.formData,
        source: row.booking.source,
        confirmationCode: row.booking.confirmationCode,
        createdAt: row.booking.createdAt,
        updatedAt: row.booking.updatedAt,
        serviceName: row.service?.name || null,
        servicePrice: row.service?.price || null,
        formName: row.form?.name || null,
      }))
      
      const response: ServerQueryResponse<typeof formattedData[0]> = {
        data: formattedData,
        totalCount,
        pageCount: Math.ceil(totalCount / pagination.pageSize),
      }

      return response
    } catch (error) {
      console.error('❌ getBookingsTable failed:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        organizationId,
        filters: data.filters,
        search: data.search
      })
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to fetch bookings'
      )
    }
  })

// Get single booking by ID
export const getBooking = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId } = context
    
    try {
      const result = await db
        .select({
          booking: bookings,
          service: services,
          form: bookingForms,
          creator: user,
        })
        .from(bookings)
        .leftJoin(services, eq(bookings.serviceId, services.id))
        .leftJoin(bookingForms, eq(bookings.formId, bookingForms.id))
        .leftJoin(user, eq(bookings.createdBy, user.id))
        .where(and(
          eq(bookings.id, data.id),
          eq(bookings.organizationId, organizationId)
        ))
        .limit(1)
      
      if (!result.length) {
        throw AppError.notFound('Booking')
      }
      
      const row = result[0]
      
      return {
        id: row.booking.id,
        organizationId: row.booking.organizationId,
        customerName: row.booking.customerName,
        customerEmail: row.booking.customerEmail,
        customerPhone: row.booking.customerPhone,
        bookingStartAt: row.booking.bookingStartAt,
        bookingEndAt: row.booking.bookingEndAt,
        duration: row.booking.duration,
        price: row.booking.price,
        status: row.booking.status,
        cancellationReason: row.booking.cancellationReason,
        notes: row.booking.notes,
        internalNotes: row.booking.internalNotes,
        formData: row.booking.formData,
        source: row.booking.source,
        confirmationCode: row.booking.confirmationCode,
        reminderSent: row.booking.reminderSent,
        reminderSentAt: row.booking.reminderSentAt,
        createdAt: row.booking.createdAt,
        updatedAt: row.booking.updatedAt,
        service: row.service ? {
          id: row.service.id,
          name: row.service.name,
          description: row.service.description,
          duration: row.service.duration,
          price: row.service.price,
        } : null,
        form: row.form ? {
          id: row.form.id,
          name: row.form.name,
          description: row.form.description,
        } : null,
        createdBy: row.creator ? {
          id: row.creator.id,
          name: row.creator.name,
          email: row.creator.email,
        } : null,
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to fetch booking'
      )
    }
  })

// Get all booking IDs for select all functionality
export const getAllBookingsIds = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(validateServerQueryParams)
  .handler(async ({ data, context }) => {
    const { organizationId } = context
    
    const { search, filters } = data
    
    try {
      // Build where conditions (same as table query)
      const conditions: SQL[] = [eq(bookings.organizationId, organizationId)]
      
      // Add search filter
      if (search) {
        conditions.push(
          or(
            ilike(bookings.customerName, `%${search}%`),
            ilike(bookings.customerEmail, `%${search}%`),
            ilike(bookings.customerPhone, `%${search}%`),
            ilike(bookings.confirmationCode, `%${search}%`)
          )!
        )
      }
      
      // Add column filters
      Object.entries(filters).forEach(([columnId, value]) => {
        if (value === undefined || value === null) return
        
        const { operator, value: filterValue } = parseFilterValue(value)
        
        const columnMap: Record<string, PgColumn> = {
          bookingStartAt: bookings.bookingStartAt,
          customerName: bookings.customerName,
          status: bookings.status,
          serviceName: bookings.serviceId,
          price: bookings.price,
        }
        
        const column = columnMap[columnId]
        if (column) {
          const processedValue = preprocessFilterValue(columnId, filterValue)
          
          const filter = buildColumnFilter({
            column,
            operator,
            value: processedValue,
          })
          if (filter) conditions.push(filter)
        }
      })
      
      const result = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(...conditions))
      
      return {
        ids: result.map(r => r.id),
      }
    } catch (error) {
      console.error('❌ getAllBookingsIds failed:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        organizationId,
        filters: data.filters,
        search: data.search
      })
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to fetch booking IDs'
      )
    }
  })