import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useSetPageMeta } from '@/lib/hooks/page-context'
import { inviteMember, removeMember, updateMemberRole } from '@/features/organization/lib/members.server'
import { toast } from 'sonner'
import { UserPlus, Mail, Trash2, Crown, Shield, User as UserIcon } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/members')({
  component: OrganizationMembers,
})

function OrganizationMembers() {
  const { activeOrganizationId } = useActiveOrganization()
  const [isInviting, setIsInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [members, setMembers] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [membersLoading, setMembersLoading] = useState(true)

  // Set page metadata
  useSetPageMeta({
    title: 'Members',
    actions: !isInviting ? (
      <button
        onClick={() => setIsInviting(true)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        <UserPlus className="w-4 h-4" />
        Invite Member
      </button>
    ) : null
  }, [isInviting])

  const loadData = async () => {
    if (!activeOrganizationId) return

    setMembersLoading(true)
    try {
      const [membersResult, invitationsResult] = await Promise.all([
        authClient.organization.listMembers({ query: { organizationId: activeOrganizationId } }),
        authClient.organization.listInvitations({ query: { organizationId: activeOrganizationId } })
      ])

      setMembers((membersResult as any).members || [])
      setInvitations((invitationsResult as any) || [])
    } catch (error) {
      console.error('Failed to load organization data:', error)
    } finally {
      setMembersLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeOrganizationId])

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    try {
      await inviteMember({
        data: {
          organizationId: activeOrganizationId || '',
          email: inviteEmail,
          role: inviteRole
        }
      })

      toast.success('Invitation sent!')
      setInviteEmail('')
      setIsInviting(false)
      loadData()
    } catch (error) {
      toast.error('Failed to send invitation')
    }
  }

  const handleRemoveMember = async (memberId: string, userName: string) => {
    const confirmed = confirm(`Are you sure you want to remove ${userName} from this organization?`)
    if (!confirmed) return

    try {
      await removeMember({
        data: {
          organizationId: activeOrganizationId || '',
          memberIdOrEmail: memberId
        }
      })

      toast.success('Member removed')
      loadData()
    } catch (error) {
      toast.error('Failed to remove member')
    }
  }

  const handleUpdateMemberRole = async (memberId: string, newRole: 'member' | 'admin' | 'owner') => {
    try {
      await updateMemberRole({
        data: {
          organizationId: activeOrganizationId || '',
          memberId: memberId,
          role: newRole
        }
      })

      toast.success('Role updated')
      loadData()
    } catch (error) {
      toast.error('Failed to update role')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const result = await authClient.organization.cancelInvitation({
        invitationId
      })

      if (result.error) {
        toast.error(result.error.message || 'Failed to cancel invitation')
      } else {
        toast.success('Invitation cancelled')
        loadData()
      }
    } catch (error) {
      toast.error('Failed to cancel invitation')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-600" />
      case 'admin': return <Shield className="w-4 h-4 text-primary" />
      default: return <UserIcon className="w-4 h-4 text-muted-foreground" />
    }
  }

  if (membersLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto w-full">

        {/* Invite Form */}
        {isInviting && (
          <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
            <h3 className="text-lg font-semibold mb-4">Invite New Member</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="w-full px-4 py-2 border-input border rounded-lg focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-4 py-2 border-input border rounded-lg focus:ring-2 focus:ring-ring"
                >
                  <option value="member">Member - Can create and edit todos</option>
                  <option value="admin">Admin - Can manage members and todos</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleInviteMember}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Send Invitation
                </button>
                <button
                  onClick={() => {
                    setIsInviting(false)
                    setInviteEmail('')
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending Invitations */}
        {invitations && invitations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border mb-6">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-foreground">Pending Invitations</h3>
            </div>
            <div className="divide-y">
              {invitations.map((invitation: any) => (
                <div key={invitation.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Invited as {invitation.role} • Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelInvitation(invitation.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Members */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-foreground">Current Members</h3>
          </div>
          <div className="divide-y">
            {members?.map((member: any) => (
              <div key={member.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    {member.user.image ? (
                      <img src={member.user.image} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <UserIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.user.name || member.user.email}</p>
                      {getRoleIcon(member.role)}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.user.email}</p>
                    <p className="text-xs text-muted-foreground/70">
                      Joined {new Date(member.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.role !== 'owner' && (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateMemberRole(member.id, e.target.value as 'member' | 'admin' | 'owner')}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.id, member.user.name || member.user.email)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {member.role === 'owner' && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      Owner
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(!members || members.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No members yet
            </div>
          )}
        </div>
    </div>
  )
}