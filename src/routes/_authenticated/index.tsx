import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus, Calendar, Clock, FileText, Eye } from 'lucide-react'
import { useState } from 'react'

import { createForm } from '@/features/booking/lib/forms.server'
import { useErrorHandler } from '@/lib/errors/hooks'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Badge } from '@/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/table'
import { PageHeader } from '@/components/page-header'

export const Route = createFileRoute('/_authenticated/')({
  component: BookingsListPage,
  loader: async () => {
    // TODO: Load actual bookings data when server functions are implemented
    // For now return empty data
    return {
      bookings: [],
      stats: {
        totalBookings: 0,
        pendingBookings: 0,
        confirmedBookings: 0,
        completedBookings: 0,
      }
    }
  },
})

function BookingsListPage() {
  const { bookings, stats } = Route.useLoaderData()
  const navigate = useNavigate()
  const { showError, showSuccess } = useErrorHandler()
  const [isCreating, setIsCreating] = useState(false)

  // Handle immediate form creation (like createTodo pattern)
  const handleCreateForm = async () => {
    setIsCreating(true)
    try {
      const created = await createForm({
        name: 'Untitled Form',
        description: '',
      })

      showSuccess('Form created')
      console.log('📝 Attempting navigation to:', `/forms/${created.id}/edit`)
      
      // Try navigation with different syntax  
      try {
        navigate({ to: '/forms/$formId/edit', params: { formId: created.id } })
        console.log('📝 Navigation call completed')
      } catch (navError) {
        console.error('❌ Navigation failed:', navError)
        // Fallback navigation
        window.location.href = `/forms/${created.id}/edit`
      }
    } catch (error) {
      showError(error)
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Bookings"
        actions={
          <Button onClick={handleCreateForm} disabled={isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? 'Creating...' : 'Create Form'}
          </Button>
        }
      />
      <div className="flex-1 p-4">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalBookings}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pendingBookings}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
                <Calendar className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.confirmedBookings}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <Calendar className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.completedBookings}</div>
              </CardContent>
            </Card>
          </div>

          {/* Bookings Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Bookings</CardTitle>
                <div className="flex items-center space-x-2">
                  <Link to="/forms">
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Manage Forms
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {bookings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Form</TableHead>
                      <TableHead>Date Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking: any) => (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{booking.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {booking.customerEmail}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{booking.serviceName}</TableCell>
                        <TableCell>{booking.formName}</TableCell>
                        <TableCell>
                          {new Date(booking.submittedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            Submitted
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No bookings yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first form to start receiving bookings
                  </p>
                  <Link to="/forms/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Form
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
