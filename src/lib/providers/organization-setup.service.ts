import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/lib/db/db'
import { organization, member, simproCompanies } from '@/database/schema'
import type { CompanyInfo } from './provider-info.interface'
import { createProviderInfoService } from './provider-registry'

/**
 * Service for setting up organizations from provider data
 * Handles both single and multi-company scenarios
 */
export class OrganizationSetupService {

  /**
   * Set up organizations for a user based on their provider data
   * This is called after successful OAuth authentication
   */
  async setupOrganizationsFromProvider(params: {
    userId: string
    providerType: string
    accessToken: string
    refreshToken: string
    buildConfig: {
      buildName: string
      domain: string
      baseUrl: string
    }
    onTokenRefresh?: (
      accessToken: string,
      refreshToken: string,
      accessTokenExpiresAt: number,
      refreshTokenExpiresAt: number
    ) => Promise<void>
  }): Promise<{
    organizations: Array<{
      id: string
      name: string
      providerCompanyId: string
    }>
    defaultOrganizationId?: string
  }> {
    const {
      userId,
      providerType,
      accessToken,
      refreshToken,
      buildConfig,
      onTokenRefresh
    } = params

    console.log(`Setting up organizations for user ${userId} with provider ${providerType}`)

    try {
      // Create provider info service
      const providerService = createProviderInfoService(
        providerType,
        accessToken,
        refreshToken,
        buildConfig,
        userId,
        onTokenRefresh
      )

      // Get all companies user has access to
      const companies = await providerService.getCompanies()
      console.log(`Found ${companies.length} companies for user ${userId}`)

      const createdOrganizations = []
      let defaultOrganizationId: string | undefined

      for (const company of companies) {
        // Check if organization already exists for this provider company
        const existingOrg = await this.findOrganizationByProviderCompany(
          providerType,
          company.id
        )

        let orgId: string

        if (existingOrg) {
          console.log(`Organization already exists for ${providerType} company ${company.id}: ${existingOrg.id}`)
          orgId = existingOrg.id

          // Update organization with latest company data
          await this.updateOrganizationFromCompanyInfo(existingOrg.id, company)
        } else {
          // Create new organization
          console.log(`Creating new organization for ${providerType} company ${company.id}`)
          orgId = await this.createOrganizationFromCompanyInfo(company, providerType, accessToken)
        }

        // Ensure user is a member (owner) of this organization
        await this.ensureUserIsMember(userId, orgId, 'owner')

        createdOrganizations.push({
          id: orgId,
          name: company.name
        })

        // For single company or first company, set as default
        if (!defaultOrganizationId || company.id === '0') {
          defaultOrganizationId = orgId
        }
      }

      console.log(`Successfully set up ${createdOrganizations.length} organizations for user ${userId}`)

      return {
        organizations: createdOrganizations,
        defaultOrganizationId
      }
    } catch (error) {
      console.error(`Error setting up organizations for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Find an organization by provider type and company ID
   */
  private async findOrganizationByProviderCompany(
    providerType: string,
    providerCompanyId: string
  ) {
    // First find the simpro company config with this company ID
    const simproConfigs = await db
      .select({
        organizationId: simproCompanies.organizationId,
      })
      .from(simproCompanies)
      .where(eq(simproCompanies.companyId, providerCompanyId))
      .limit(1)

    if (!simproConfigs.length) {
      return null
    }

    // Then get the organization
    const orgs = await db
      .select()
      .from(organization)
      .where(
        and(
          eq(organization.id, simproConfigs[0].organizationId),
          eq(organization.providerType, providerType)
        )
      )
      .limit(1)

    return orgs[0] || null
  }

  /**
   * Create a new organization from company info
   */
  private async createOrganizationFromCompanyInfo(
    companyInfo: CompanyInfo,
    providerType: string,
    accessToken: string
  ): Promise<string> {
    const orgId = nanoid()
    const slug = this.generateSlug(companyInfo.name)

    await db.insert(organization).values({
      id: orgId,
      name: companyInfo.name,
      slug,
      phone: companyInfo.phone,
      email: companyInfo.email,
      website: companyInfo.website,
      timezone: companyInfo.timezone,
      currency: companyInfo.currency,
      addressLine1: companyInfo.address?.line1,
      addressLine2: companyInfo.address?.line2,
      addressCity: companyInfo.address?.city,
      addressState: companyInfo.address?.state,
      addressPostalCode: companyInfo.address?.postalCode,
      addressCountry: companyInfo.address?.country,
      providerType
    })

    // Create provider-specific configuration if needed
    if (providerType === 'simpro' && companyInfo.providerData) {
      await this.createSimproConfiguration(orgId, companyInfo.providerData, accessToken, companyInfo.id)
    }

    return orgId
  }

  /**
   * Create Simpro company configuration
   */
  private async createSimproConfiguration(
    organizationId: string,
    providerData: any,
    accessToken: string,
    companyId: string = '0'
  ): Promise<void> {
    if (providerData.buildName && providerData.domain) {
      await db.insert(simproCompanies).values({
        id: nanoid(),
        organizationId,
        accessToken,
        buildName: providerData.buildName,
        domain: providerData.domain,
        companyId, // Use the actual company ID
      })
    }
  }

  /**
   * Update an existing organization with fresh company data
   */
  private async updateOrganizationFromCompanyInfo(
    organizationId: string,
    companyInfo: CompanyInfo
  ): Promise<void> {

    await db
      .update(organization)
      .set({
        name: companyInfo.name,
        phone: companyInfo.phone,
        email: companyInfo.email,
        website: companyInfo.website,
        timezone: companyInfo.timezone,
        currency: companyInfo.currency,
        addressLine1: companyInfo.address?.line1,
        addressLine2: companyInfo.address?.line2,
        addressCity: companyInfo.address?.city,
        addressState: companyInfo.address?.state,
        addressPostalCode: companyInfo.address?.postalCode,
        addressCountry: companyInfo.address?.country,
        updatedAt: new Date(),
      })
      .where(eq(organization.id, organizationId))

  }

  /**
   * Ensure user is a member of the organization with the specified role
   */
  private async ensureUserIsMember(
    userId: string,
    organizationId: string,
    role: string = 'owner'
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
  private generateSlug(name: string): string {
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

  /**
   * Get organizations for a user by provider type
   */
  async getOrganizationsByProvider(
    userId: string,
    providerType: string
  ): Promise<Array<{
    id: string
    name: string
  }>> {
    const orgs = await db
      .select({
        id: organization.id,
        name: organization.name,
      })
      .from(organization)
      .innerJoin(member, eq(member.organizationId, organization.id))
      .where(
        and(
          eq(member.userId, userId),
          eq(organization.providerType, providerType)
        )
      )

    return orgs
  }
}

// Export singleton instance
export const organizationSetupService = new OrganizationSetupService()