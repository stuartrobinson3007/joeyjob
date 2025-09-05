import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { toast } from 'sonner'
import { Ban, UserCheck, Eye, Search } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/superadmin/users')({
  component: SuperAdminUsers,
})

function SuperAdminUsers() {
  const [searchTerm, setSearchTerm] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [isPending, setIsPending] = useState(true)

  const loadUsers = async () => {
    setIsPending(true)

    try {
      const result = await authClient.admin.listUsers({
        query: {
          limit: 100,
          offset: 0
        }
      })

      const usersData = (result as any).data?.users || []
      setUsers(usersData)
    } catch (error) {
      console.error('❌ SuperAdmin Users - API call failed:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown'
      })
      toast.error('Failed to load users')
    } finally {
      setIsPending(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleBanUser = async (userId: string, banned: boolean) => {
    try {
      await authClient.admin.banUser({
        userId,
        banReason: banned ? 'Admin action' : undefined
      })
      toast.success(banned ? 'User banned' : 'User unbanned')
      loadUsers()
    } catch (error) {
      toast.error('Failed to update user ban status')
    }
  }

  const handleSetRole = async (userId: string, role: 'user' | 'admin') => {
    try {
      await authClient.admin.setRole({
        userId,
        role
      })
      toast.success('User role updated')
      loadUsers()
    } catch (error) {
      toast.error('Failed to update user role')
    }
  }

  const handleImpersonate = async (userId: string) => {
    try {
      await authClient.admin.impersonateUser({ userId })
      toast.success('Impersonation started')
      window.location.href = '/'
    } catch (error) {
      toast.error('Failed to impersonate user')
    }
  }

  const filteredUsers = users?.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (isPending) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">User Management</h1>

      <div className="bg-card rounded-lg shadow">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full pl-10 pr-4 py-2 border-input border rounded-lg focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((user) => {
                return (
                  <tr key={user.id} className="hover:bg-accent">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {user.name || 'No name'}
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role || 'user'}
                        onChange={(e) => handleSetRole(user.id, e.target.value as 'user' | 'admin')}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.banned ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Banned
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleImpersonate(user.id)}
                          className="text-primary hover:text-primary/80"
                          title="Impersonate user"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleBanUser(user.id, !user.banned)}
                          className={user.banned ? 'text-green-600 hover:text-green-900' : 'text-red-600 hover:text-red-900'}
                          title={user.banned ? 'Unban user' : 'Ban user'}
                        >
                          {user.banned ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No users found
          </div>
        )}
      </div>
    </div>
  )
}