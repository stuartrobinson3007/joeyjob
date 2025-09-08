export interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  role?: string | null
  banned?: boolean | null
  banReason?: string | null
  banExpires?: Date | null
  firstName?: string | null
  lastName?: string | null
  onboardingCompleted?: boolean | null
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  userId: string
  expiresAt: Date
  ipAddress?: string | null
  userAgent?: string | null
  activeOrganizationId?: string | null
  impersonatedBy?: string | null
  user: User
  createdAt: Date
  updatedAt: Date
}

export interface Account {
  id: string
  accountId: string
  providerId: string
  userId: string
  accessToken?: string | null
  refreshToken?: string | null
  idToken?: string | null
  accessTokenExpiresAt?: Date | null
  refreshTokenExpiresAt?: Date | null
  scope?: string | null
  password?: string | null
  createdAt: Date
  updatedAt: Date
}
