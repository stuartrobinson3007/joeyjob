import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Building2, Users, Calendar, Trash2, MoreHorizontal } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { useErrorHandler } from '@/lib/errors/hooks'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/lib/errors/client-handler'
import { authClient } from '@/lib/auth/auth-client'
import {
  DataTable,
  DataTableHeader,
  useTableQuery,
  DataTableConfig,
  DataTableColumnMeta,
} from '@/components/taali-ui/data-table'
import {
  getAdminWorkspacesTable,
  getAdminWorkspaceStats,
  type AdminWorkspace,
} from '@/features/admin/lib/admin-workspaces.server'
import { Badge } from '@/components/taali-ui/ui/badge'
import { Button } from '@/components/taali-ui/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/taali-ui/ui/dropdown-menu'
import { useTranslation } from '@/i18n/hooks/useTranslation'

export const Route = createFileRoute('/_authenticated/superadmin/workspaces')({
  component: SuperAdminWorkspaces,
})

function SuperAdminWorkspaces() {
  const { t } = useTranslation('admin')
  const { t: tCommon } = useTranslation('common')
  const { t: tNotifications } = useTranslation('notifications')
  const { showError, showSuccess } = useErrorHandler()
  const [currentFilters, setCurrentFilters] = React.useState({})

  // Query for total stats (independent of filters)
  const { data: stats } = useQuery({
    queryKey: ['admin', 'workspaces', 'stats'],
    queryFn: () => getAdminWorkspaceStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Use the table query hook
  const { data, totalCount, isLoading, isFetching, isError, error, onStateChange, refetch } =
    useTableQuery<AdminWorkspace>({
      queryKey: ['admin', 'workspaces', 'table'],
      queryFn: params => {
        setCurrentFilters(params)
        return getAdminWorkspacesTable({ data: params })
      },
      enabled: true,
    })

  const handleDeleteOrganization = React.useCallback(
    async (orgId: string, orgName: string) => {
      const confirmed = confirm(tNotifications('confirmations.deleteOrganization', { orgName }))
      if (!confirmed) return

      try {
        // This would need to be an admin-only delete function
        const result = await authClient.organization.delete({
          organizationId: orgId,
        })

        if (result.error) {
          showError(result.error.message || t('common:messages.organizationDeleteFailed'))
        } else {
          showSuccess(t('common:messages.organizationDeleted'))
          refetch()
        }
      } catch (error) {
        showError(error)
      }
    },
    [refetch, tNotifications, t, showError, showSuccess]
  )

  // Column definitions
  const columns = React.useMemo<ColumnDef<AdminWorkspace>[]>(
    () => [
      {
        accessorKey: 'id',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            ID
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 100,
        cell: ({ row }) => {
          const org = row.original
          return <div className="text-xs font-mono text-muted-foreground">{org.id}</div>
        },
        meta: {
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        id: 'organization',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('workspaces.organization')}
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
                <div className="text-sm font-medium text-foreground">{org.name}</div>
                <div className="text-sm text-muted-foreground">
                  {org.slug || tCommon('table.unknown')}
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
        accessorKey: 'memberCount',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('workspaces.members')}
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          const org = row.original
          return (
            <div className="flex items-center text-sm text-foreground">
              <Users className="w-4 h-4 mr-2 text-muted-foreground" />
              {org.memberCount || 0} {String(t('workspaces.members')).toLowerCase()}
            </div>
          )
        },
        meta: {
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('workspaces.created')}
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 150,
        cell: ({ row }) => {
          const org = row.original
          return (
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar />
              {new Date(org.createdAt).toLocaleDateString()}
            </div>
          )
        },
        meta: {
          filterConfig: {
            type: 'dateRange',
            title: t('workspaces.createdDate'),
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        id: 'status',
        header: () => <span>{tCommon('labels.status')}</span>,
        size: 100,
        cell: () => {
          return (
            <Badge variant="success" appearance="soft" status>
              {t('users.active')}
            </Badge>
          )
        },
        enableSorting: false,
        meta: {
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        id: 'actions',
        header: () => null,
        size: 50,
        enableResizing: false,
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
                  <DropdownMenuItem onClick={() => handleDeleteOrganization(org.id, org.name)}>
                    <Trash2 />
                    {t('workspaces.deleteOrganization')}
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
    ],
    [handleDeleteOrganization, t, tCommon]
  )

  // DataTable configuration
  const config = React.useMemo<DataTableConfig<AdminWorkspace>>(
    () => ({
      searchConfig: {
        placeholder: t('workspaces.search'),
        searchableColumns: ['name', 'slug', 'id'],
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
    }),
    [t]
  )

  // Handle table errors
  if (isError && error && !isLoading) {
    return <ErrorState error={parseError(error)} onRetry={refetch} />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0">
        {/* Organization Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">{t('analytics.totalWorkspaces')}</h3>
            <p className="text-2xl font-bold">{stats?.totalOrganizations || 0}</p>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">{t('workspaces.members')}</h3>
            <p className="text-2xl font-bold">{stats?.totalMembers || 0}</p>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">{t('workspaces.members')} per Org</h3>
            <p className="text-2xl font-bold">{stats?.avgMembersPerOrg || 0}</p>
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
          getRowIdProp={row => row.id}
        />
      </div>
    </div>
  )
}
