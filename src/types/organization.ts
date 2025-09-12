export interface Organization {
  id: string
  name: string
  slug?: string | null
  logo?: string | null
  timezone: string
  createdAt: Date
  updatedAt: Date
  metadata?: string | null
}

export interface Member {
  id: string
  organizationId: string
  userId: string
  role: string
  createdAt: Date
  organization?: Organization
  user?: import('./auth').User
}

export interface Invitation {
  id: string
  organizationId: string
  email: string
  role?: string | null
  status: string
  expiresAt: Date
  inviterId: string
  organization?: Organization
  inviter?: import('./auth').User
}

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer'
