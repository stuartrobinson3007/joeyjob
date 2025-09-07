import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { authClient } from '@/lib/auth/auth-client'
import { toast } from 'sonner'
import { Building2, Users, Calendar, Trash2, MoreHorizontal } from 'lucide-react'
import { useListOrganizations } from '@/lib/auth/auth-hooks'
import { DataTable, DataTableHeader, useTableQuery, DataTableConfig, DataTableColumnMeta } from '@/components/taali-ui/data-table'
import { getAdminWorkspacesTable, type AdminWorkspace } from '@/features/admin/lib/admin-workspaces.server'
import { Badge } from '@/components/taali-ui/ui/badge'
import { Button } from '@/components/taali-ui/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/taali-ui/ui/dropdown-menu'

export const Route = createFileRoute('/_authenticated/superadmin/workspaces')({
  component: SuperAdminWorkspaces,
})

function SuperAdminWorkspaces() {
  const [currentFilters, setCurrentFilters] = React.useState({})

  // Use the table query hook
  const {
    data,
    totalCount,
    isLoading,
    isFetching,
    onStateChange,
    refetch,
  } = useTableQuery<AdminWorkspace>({
    queryKey: ['admin', 'workspaces', 'table'],
    queryFn: (params) => {
      setCurrentFilters(params)
      return getAdminWorkspacesTable({ data: params })
    },
    enabled: true,
  })

  const handleDeleteOrganization = React.useCallback(async (orgId: string, orgName: string) => {
    const confirmed = confirm(`Are you sure you want to delete "${orgName}"? This will permanently delete all data associated with this organization.`)
    if (!confirmed) return

    try {
      // This would need to be an admin-only delete function
      const result = await authClient.organization.delete({
        organizationId: orgId
      })

      if (result.error) {
        toast.error(result.error.message || 'Failed to delete organization')
      } else {
        toast.success('Organization deleted')
        refetch()
      }
    } catch (error) {
      toast.error('Failed to delete organization')
    }
  }, [refetch])


  // Column definitions
  const columns = React.useMemo<ColumnDef<AdminWorkspace>[]>(() => [
    {
      id: "organization",
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          Organization
        </DataTableHeader>
      ),
      enableSorting: true,
      size: 300,
      cell: ({ row }) => {
        const org = row.original
        return (
          <div className="flex items-center">
            <Building2 className="w-5 h-5 text-muted-foreground mr-3" />
            <div>
              <div className="text-sm font-medium text-foreground">
                {org.name}
              </div>
              <div className="text-sm text-muted-foreground">
                {org.slug || 'No slug'}
              </div>
            </div>
          </div>
        )
      },
      meta: {
        enableTextTruncation: true,
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "memberCount",
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          Members
        </DataTableHeader>
      ),
      enableSorting: true,
      size: 120,
      cell: ({ row }) => {
        const org = row.original
        return (
          <div className="flex items-center text-sm text-foreground">
            <Users className="w-4 h-4 mr-2 text-muted-foreground" />
            {org.memberCount || 0} members
          </div>
        )
      },
      meta: {
        enableTextTruncation: false,
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          Created
        </DataTableHeader>
      ),
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
      cell: ({ row }) => {
        const org = row.original
        return (
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 mr-2" />
            {new Date(org.createdAt).toLocaleDateString()}
          </div>
        )
      },
      meta: {
        filterConfig: {
          type: "dateRange",
          title: "Created Date",
        },
        enableTextTruncation: false,
      } as DataTableColumnMeta,
    },
    {
      id: "status",
      header: () => <span>Status</span>,
      size: 100,
      cell: () => {
        return (
          <Badge variant="success" style="soft" status>
            Active
          </Badge>
        )
      },
      enableSorting: false,
      meta: {
        enableTextTruncation: false,
      } as DataTableColumnMeta,
    },
    {
      id: "actions",
      header: () => <span className="text-right">Actions</span>,
      size: 50,
      cell: ({ row }) => {
        const org = row.original
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem 
                  onClick={() => handleDeleteOrganization(org.id, org.name)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      enableSorting: false,
      meta: {
        enableTextTruncation: false,
      } as DataTableColumnMeta,
    },
  ], [handleDeleteOrganization])

  // DataTable configuration
  const config = React.useMemo<DataTableConfig<AdminWorkspace>>(() => ({
    searchConfig: {
      placeholder: "Search organizations..."
    },
    enableColumnFilters: true,
    enableSorting: true,
    enableRowSelection: false,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    paginationConfig: {
      pageSizeOptions: [10, 20, 30, 50],
      defaultPageSize: 10,
    },
    resizingConfig: {
      enableColumnResizing: true,
    },
  }), [])

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0">
        {/* Organization Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">Total Organizations</h3>
            <p className="text-2xl font-bold">{totalCount || 0}</p>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">Total Members</h3>
            <p className="text-2xl font-bold">
              {data?.reduce((sum, org) => sum + (org.memberCount || 0), 0) || 0}
            </p>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">Avg Members per Org</h3>
            <p className="text-2xl font-bold">
              {totalCount ? Math.round((data?.reduce((sum, org) => sum + (org.memberCount || 0), 0) || 0) / totalCount) : 0}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        <DataTable
          columns={columns}
          data={data}
          config={config}
          totalCount={totalCount}
          onStateChange={onStateChange}
          currentFilters={currentFilters}
          isLoading={isLoading}
          isFetching={isFetching}
          getRowIdProp={(row) => row.id}
        />
      </div>
    </div>
  )
}