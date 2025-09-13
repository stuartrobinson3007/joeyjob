import { createServerFileRoute } from '@tanstack/react-start/server'
import { syncEmployeesFromProvider } from '@/lib/employees/server'

export const ServerRoute = createServerFileRoute('/api/employees/sync').methods({
  POST: async ({ request }) => {
    try {
      // Use new middleware-based server function
      const result = await syncEmployeesFromProvider()
      return Response.json(result)
    } catch (error) {
      console.error('Error syncing organization employees:', error)
      return Response.json(
        { error: error instanceof Error ? error.message : 'Failed to sync employees' },
        { status: 500 }
      )
    }
  }
})