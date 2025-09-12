import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/lib/db/db'
import { organization, member, account } from '@/database/schema'
import { createProviderInfoService } from './provider-registry'

/**
 * Set up organizations for a newly authenticated user
 * Called from OAuth callback - checks for existing orgs and creates/joins as needed
 */
export async function setupUserOrganizations(
  userId: string,
  tokens: {
    accessToken: string
    refreshToken: string
  },
  buildConfig: {
    buildName: string
    domain: string
    baseUrl: string
  },
  providerType: string = 'simpro'
): Promise<{
  organizations: Array<{
    id: string
    name: string
    providerCompanyId: string
    isNew: boolean
  }>
  defaultOrganizationId?: string
}> {
  console.log(`Setting up organizations for user ${userId} with provider ${providerType}`)

  try {
    // Create provider info service to get company data
    const providerService = createProviderInfoService(
      providerType,
      tokens.accessToken,
      tokens.refreshToken,
      buildConfig,
      userId
    )

    // Get all companies user has access to
    const companies = await providerService.getCompanies()
    console.log(`Found ${companies.length} companies for user ${userId}`)

    const processedOrganizations = []
    let defaultOrganizationId: string | undefined

    for (const company of companies) {
      console.log(`Processing company: ${company.name} (ID: ${company.id})`)

      // Check if organization already exists for this provider company
      const existingOrgs = await db
        .select({
          id: organization.id,
          name: organization.name,
        })
        .from(organization)
        .where(
          and(
            eq(organization.providerType, providerType),
            eq(organization.providerCompanyId, company.id)
          )
        )
        .limit(1)

      let orgId: string
      let isNew = false

      if (existingOrgs.length > 0) {
        // Organization exists - use existing
        orgId = existingOrgs[0].id
        console.log(`Organization already exists for ${providerType} company ${company.id}: ${orgId}`)

        // Update organization with latest company data
        await updateOrganizationFromCompanyInfo(orgId, company)
      } else {
        // Create new organization
        orgId = await createOrganizationFromCompanyInfo(company, providerType)
        isNew = true
        console.log(`Created new organization for ${providerType} company ${company.id}: ${orgId}`)
      }

      // Ensure user is a member of this organization
      await ensureUserIsMember(userId, orgId, isNew ? 'owner' : 'member')

      processedOrganizations.push({
        id: orgId,
        name: company.name,
        providerCompanyId: company.id,
        isNew
      })

      // Set default organization (prefer company ID '0' for single-company, or first one)
      if (!defaultOrganizationId || company.id === '0') {
        defaultOrganizationId = orgId
      }
    }

    console.log(`Successfully processed ${processedOrganizations.length} organizations for user ${userId}`)
    
    return {
      organizations: processedOrganizations,
      defaultOrganizationId
    }
  } catch (error) {
    console.error(`Error setting up organizations for user ${userId}:`, error)
    throw error
  }
}

/**
 * Create a new organization from company info
 */
async function createOrganizationFromCompanyInfo(
  companyInfo: any,
  providerType: string
): Promise<string> {
  const orgId = nanoid()
  const slug = generateSlug(companyInfo.name)

  await db.insert(organization).values({
    id: orgId,
    name: companyInfo.name,
    slug,
    phone: companyInfo.phone,
    email: companyInfo.email,
    website: companyInfo.website,
    timezone: companyInfo.timezone || 'America/New_York',
    currency: companyInfo.currency,
    addressStreet: companyInfo.address?.street,
    addressCity: companyInfo.address?.city,
    addressState: companyInfo.address?.state,
    addressPostalCode: companyInfo.address?.postalCode,
    addressCountry: companyInfo.address?.country,
    providerType,
    providerCompanyId: companyInfo.id,
    providerData: companyInfo.providerData,
    onboardingCompleted: false, // Will be set to true after user confirms data
  })

  return orgId
}

/**
 * Update an existing organization with fresh company data
 */
async function updateOrganizationFromCompanyInfo(
  organizationId: string,
  companyInfo: any
): Promise<void> {
  await db
    .update(organization)
    .set({
      name: companyInfo.name,
      phone: companyInfo.phone,
      email: companyInfo.email,
      website: companyInfo.website,
      timezone: companyInfo.timezone || 'America/New_York',
      currency: companyInfo.currency,
      addressStreet: companyInfo.address?.street,
      addressCity: companyInfo.address?.city,
      addressState: companyInfo.address?.state,
      addressPostalCode: companyInfo.address?.postalCode,
      addressCountry: companyInfo.address?.country,
      providerData: companyInfo.providerData,
      updatedAt: new Date(),
    })
    .where(eq(organization.id, organizationId))
}

/**
 * Ensure user is a member of the organization
 */
async function ensureUserIsMember(
  userId: string,
  organizationId: string,
  role: string = 'member'
): Promise<void> {
  // Check if membership already exists
  const existingMembership = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, organizationId)
      )
    )
    .limit(1)

  if (existingMembership.length === 0) {
    // Create membership
    await db.insert(member).values({
      id: nanoid(),
      userId,
      organizationId,
      role,
    })
    console.log(`Added user ${userId} as ${role} of organization ${organizationId}`)
  } else {
    console.log(`User ${userId} is already a member of organization ${organizationId}`)
  }
}

/**
 * Generate a URL-friendly slug from organization name
 */
function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .substring(0, 50) // Limit length

  // Add random suffix to ensure uniqueness
  return `${baseSlug}-${nanoid(8)}`
}