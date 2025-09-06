import { serverOnly } from '@tanstack/react-start'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization, magicLink, admin, emailOTP } from 'better-auth/plugins'
import { stripe as stripePlugin } from '@better-auth/stripe'
import { createAccessControl } from 'better-auth/plugins/access'
import Stripe from 'stripe'
import { defaultStatements, adminAc } from 'better-auth/plugins/organization/access'
import { reactStartCookies } from 'better-auth/react-start'
import { db } from '@/lib/db/db'
import { redis } from '@/lib/db/redis'
import { sendMagicLinkEmail, sendInvitationEmail, sendOTPEmail } from '@/lib/utils/email'
import * as schema from '@/database/schema'

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia'
})

// Use default statements and add our custom resource
const statement = {
  ...defaultStatements,  // Includes invitation permissions needed for invites to work
  todos: ["create", "read", "update", "delete", "assign"],
  billing: ["view", "manage"] // Add billing permissions
} as const

// Create access control instance
const ac = createAccessControl(statement)

// Define roles with specific permissions
const viewer = ac.newRole({
  todos: ["read"],
  member: ["read"],
  invitation: ["read"],
  billing: ["view"]
})

const member = ac.newRole({
  todos: ["create", "read", "update", "delete"],
  member: ["read"],
  invitation: ["read"],
  billing: ["view"]
})

const orgAdmin = ac.newRole({
  organization: ["update"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "read", "delete"],
  todos: ["create", "read", "update", "delete", "assign"],
  billing: ["view", "manage"]
})

const owner = ac.newRole({
  ...adminAc.statements,  // Inherit default permissions including invitation
  todos: ["create", "read", "update", "delete", "assign"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "read", "delete"],
  billing: ["view", "manage"]
})

const getAuthConfig = serverOnly(() =>
  betterAuth({
    baseURL: process.env.BETTER_AUTH_URL!,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: schema
    }),


    user: {
      additionalFields: {
        firstName: {
          type: "string",
          required: false
        },
        lastName: {
          type: "string",
          required: false
        },
        onboardingCompleted: {
          type: "boolean",
          defaultValue: false,
          required: false
        }
      }
    },

    // session: {
    //   cookieCache: {
    //     enabled: true,
    //     maxAge: 5 * 60, // 5 minutes
    //   },
    //   expiresIn: 60 * 60 * 24 * 7, // 7 days
    //   updateAge: 60 * 60 * 24 // 1 day
    // },

    secondaryStorage: {
      get: async (key) => {
        return await redis.get(key)
      },
      set: async (key, value, ttl) => {
        if (ttl) {
          await redis.set(key, value, { EX: ttl })
        } else {
          await redis.set(key, value)
        }
      },
      delete: async (key) => {
        await redis.del(key)
      }
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      ...(process.env.GITHUB_CLIENT_ID && {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        }
      })
    },

    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail(email, url)
        },
        expiresIn: 60 * 5 // 5 minutes
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          await sendOTPEmail(email, otp, type)
        },
        disableSignUp: false // Allow automatic account creation for invitations
      }),
      admin({
        adminRoles: ["superadmin"], // TODO: Not sure if this actually does anything. We keep the superadmin role in the user db for quick checks
        adminUserIds: ["gkJm4zjuCPVTbnIvKdtmWEA0r5Fz2P6V"] // But its this that actually makes a user an admin (superadmin as we call it)
      }),
      stripePlugin({
        stripeClient: stripe,
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        createCustomerOnSignUp: false, // We'll create on org creation
        successUrl: `${process.env.BETTER_AUTH_URL || 'http://localhost:2847'}/billing?success=true`,
        cancelUrl: `${process.env.BETTER_AUTH_URL || 'http://localhost:2847'}/billing`,
      }),
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 99,
        invitationExpiresIn: 60 * 60 * 48, // 48 hours
        cancelPendingInvitationsOnReInvite: false,
        requireEmailVerificationOnInvitation: false,
        sendInvitationEmail: async (data) => {
          const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${data.id}`
          await sendInvitationEmail(
            data.email,
            data.inviter?.user?.name || 'A team member',
            data.organization.name,
            inviteUrl
          )
        },
        ac,
        roles: {
          owner,
          admin: orgAdmin,
          member,
          viewer
        }
      }),
      reactStartCookies() // Must be last plugin
    ]
  })
)

export const auth = getAuthConfig()
export const roles = {
  owner,
  admin: orgAdmin,
  member,
  viewer
}
export { ac }