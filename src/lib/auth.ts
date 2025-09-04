import { serverOnly } from '@tanstack/react-start'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { reactStartCookies } from 'better-auth/react-start'
import { db } from './db'
import { redis } from './redis'
import * as schema from '../database/schema'

const getAuthConfig = serverOnly(() =>
  betterAuth({
    baseURL: process.env.BETTER_AUTH_URL!,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: schema
    }),

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24 // 1 day
    },

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
      }
    },

    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 5,
        roles: {
          owner: { permissions: ['*'] },
          admin: {
            permissions: [
              'organization:read',
              'organization:update',
              'member:read',
              'member:invite',
              'member:remove',
              'todos:*'
            ]
          },
          member: {
            permissions: [
              'organization:read',
              'member:read',
              'todos:read',
              'todos:write'
            ]
          },
          viewer: {
            permissions: [
              'organization:read',
              'member:read',
              'todos:read'
            ]
          }
        }
      }),
      reactStartCookies() // Must be last plugin
    ]
  })
)

export const auth = getAuthConfig()