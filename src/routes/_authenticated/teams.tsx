import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useSetPageMeta } from '@/lib/hooks/page-context'
import { 
  getTeamMembers, 
  inviteTeamMember, 
  removeTeamMember, 
  updateTeamMemberRole, 
  cancelTeamInvitation,
  type TeamMember 
} from '@/features/teams/lib/teams.server'
import { toast } from 'sonner'
import { 
  UserPlus, 
  Mail, 
  Trash2, 
  Crown, 
  Shield, 
  User as UserIcon, 
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  MoreHorizontal,
  Clock
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/taali-ui/ui/table'
import { Button } from '@/components/taali-ui/ui/button'
import { Input } from '@/components/taali-ui/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/taali-ui/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/taali-ui/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/taali-ui/ui/dropdown-menu'

export const Route = createFileRoute('/_authenticated/teams')({
  component: Teams,
})

type SortBy = 'name' | 'email' | 'role' | 'status' | 'joinedAt'
type SortOrder = 'asc' | 'desc'

function Teams() {
  const { activeOrganizationId } = useActiveOrganization()
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'viewer' | 'member' | 'admin'>('member')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState<SortBy>('joinedAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false
  })

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setInviteLoading(true)
    try {
      await inviteTeamMember({
        data: {
          organizationId: activeOrganizationId || '',
          email: inviteEmail,
          role: inviteRole
        }
      })

      toast.success('Invitation sent!')
      setInviteEmail('')
      setInviteRole('member') // Reset role to default
      setIsInviteDialogOpen(false)
      loadTeamMembers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  // Reset form when dialog closes
  const handleDialogChange = (open: boolean) => {
    setIsInviteDialogOpen(open)
    if (!open) {
      // Reset form values when dialog closes
      setInviteEmail('')
      setInviteRole('member')
    }
  }

  useSetPageMeta({
    title: 'Team',
    actions: (
      <Button onClick={() => setIsInviteDialogOpen(true)}>
        <UserPlus className="w-4 h-4" />
        Invite Member
      </Button>
    )
  }, [])

  const loadTeamMembers = async () => {
    if (!activeOrganizationId) return

    setLoading(true)
    try {
      const result = await getTeamMembers({
        data: {
          organizationId: activeOrganizationId,
          page: currentPage,
          pageSize,
          sortBy,
          sortOrder,
          search: searchQuery
        }
      })

      setTeamMembers(result.members)
      setPagination(result.pagination)
    } catch (error) {
      console.error('Failed to load team members:', error)
      toast.error('Failed to load team members')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTeamMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganizationId, currentPage, sortBy, sortOrder])

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1)
      } else {
        loadTeamMembers()
      }
    }, 300)

    return () => clearTimeout(debounceTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const confirmed = confirm(`Are you sure you want to remove ${memberName} from this workspace?`)
    if (!confirmed) return

    try {
      await removeTeamMember({
        data: {
          organizationId: activeOrganizationId || '',
          memberIdOrEmail: memberId
        }
      })

      toast.success('Member removed')
      loadTeamMembers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member')
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: 'viewer' | 'member' | 'admin' | 'owner') => {
    try {
      await updateTeamMemberRole({
        data: {
          organizationId: activeOrganizationId || '',
          memberId,
          role: newRole
        }
      })

      toast.success('Role updated')
      loadTeamMembers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    const confirmed = confirm('Are you sure you want to cancel this invitation?')
    if (!confirmed) return

    try {
      await cancelTeamInvitation({
        data: {
          organizationId: activeOrganizationId || '',
          invitationId
        }
      })

      toast.success('Invitation cancelled')
      loadTeamMembers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel invitation')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-600" />
      case 'admin': return <Shield className="w-4 h-4 text-primary" />
      case 'viewer': return <Eye className="w-4 h-4 text-muted-foreground" />
      default: return <UserIcon className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'admin': return 'bg-primary/10 text-primary'
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  if (loading && teamMembers.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <>
      <Dialog open={isInviteDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your workspace. They'll receive an email with instructions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="invite-email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="invite-email"
                type="email"
                placeholder="member@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                  <SelectItem value="member">Member - Can create and edit</SelectItem>
                  <SelectItem value="admin">Admin - Can manage team and settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteMember} loading={inviteLoading}>
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            id="search-members"
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="role">Role</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="joinedAt">Joined Date</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                Member {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('email')}
              >
                Email {sortBy === 'email' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('role')}
              >
                Role {sortBy === 'role' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('status')}
              >
                Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('joinedAt')}
              >
                Joined/Expires {sortBy === 'joinedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      {member.avatar ? (
                        <img src={member.avatar} alt="" className="w-8 h-8 rounded-full" />
                      ) : member.type === 'invitation' ? (
                        <Mail className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <span className="font-medium">
                      {member.name || member.email.split('@')[0]}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getRoleIcon(member.role)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {member.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm text-yellow-600">Pending</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm text-green-600">Active</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {member.joinedAt ? (
                    <span className="text-sm text-muted-foreground">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  ) : member.expiresAt ? (
                    <span className="text-sm text-muted-foreground">
                      Expires {new Date(member.expiresAt).toLocaleDateString()}
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {member.role !== 'owner' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {member.type === 'member' ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleUpdateRole(member.id, 'viewer')}
                              disabled={member.role === 'viewer'}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Set as Viewer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleUpdateRole(member.id, 'member')}
                              disabled={member.role === 'member'}
                            >
                              <UserIcon className="w-4 h-4 mr-2" />
                              Set as Member
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleUpdateRole(member.id, 'admin')}
                              disabled={member.role === 'admin'}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                              Set as Admin
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleRemoveMember(member.id, member.name || member.email)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove Member
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleCancelInvitation(member.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Cancel Invitation
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {member.role === 'owner' && (
                    <span className="text-xs text-muted-foreground">Owner</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {teamMembers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? 'No team members found matching your search' : 'No team members yet'}
          </div>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.totalCount)} of {pagination.totalCount} members
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!pagination.hasPrevious}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!pagination.hasNext}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}