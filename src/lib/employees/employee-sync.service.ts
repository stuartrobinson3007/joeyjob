import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/lib/db/db'
import { organizationEmployees } from '@/database/schema'
import { createProviderInfoService } from '@/lib/providers/provider-registry'

export interface MergedEmployee {
  id: string
  simproEmployeeId: number
  name: string
  email?: string | null
  isEnabled: boolean      // Available for bookings in JoeyJob
  isRemoved: boolean      // No longer exists in provider
  lastSyncAt: Date | null
  wasJustAdded?: boolean  // New employee from this sync
  wasJustRemoved?: boolean // Just marked as removed
}

/**
 * Service for syncing and managing employees across providers
 * Handles the merge between provider employee data and local preferences
 */
export class EmployeeSyncService {

  /**
   * Sync employees from provider and merge with local preferences
   * This is the main sync function called when refreshing employee data
   */
  async syncEmployeesFromProvider(
    organizationId: string,
    providerType: string,
    accessToken: string,
    refreshToken: string,
    buildConfig: {
      buildName: string
      domain: string  
      baseUrl: string
    },
    userId: string
  ): Promise<MergedEmployee[]> {
    try {
      // 1. Fetch current employees from provider API
      const providerService = createProviderInfoService(
        providerType,
        accessToken,
        refreshToken,
        buildConfig,
        userId
      )
      
      const providerEmployees = await providerService.getEmployees()
      
      // 2. Get existing local preferences
      const localEmployees = await db
        .select()
        .from(organizationEmployees)
        .where(eq(organizationEmployees.organizationId, organizationId))
      
      // 3. Track which provider employees we've seen
      const currentProviderIds = new Set(
        providerEmployees.map(emp => Number(emp.id))
      )
      
      const mergedEmployees: MergedEmployee[] = []
      
      // 4. Process provider employees (new + existing)
      for (const providerEmp of providerEmployees) {
        const empId = Number(providerEmp.id)
        const existingLocal = localEmployees.find(
          local => local.simproEmployeeId === empId
        )
        
        if (existingLocal) {
          // Update existing employee (keep their enabled preference)
          await db
            .update(organizationEmployees)
            .set({
              simproEmployeeName: providerEmp.name,
              simproEmployeeEmail: providerEmp.email || null,
              isRemoved: false, // Back in Simpro if was removed
              lastSyncAt: new Date(),
              syncError: null,
              updatedAt: new Date(),
            })
            .where(eq(organizationEmployees.id, existingLocal.id))
          
          mergedEmployees.push({
            id: existingLocal.id,
            simproEmployeeId: empId,
            name: providerEmp.name,
            email: providerEmp.email || null,
            isEnabled: existingLocal.isEnabled, // Keep user's preference
            isRemoved: false,
            lastSyncAt: new Date(),
            wasJustAdded: existingLocal.isRemoved, // Was removed, now back
          })
        } else {
          // Create new employee record (disabled by default)
          const newEmployeeId = nanoid()
          await db.insert(organizationEmployees).values({
            id: newEmployeeId,
            organizationId,
            simproEmployeeId: empId,
            simproEmployeeName: providerEmp.name,
            simproEmployeeEmail: providerEmp.email || null,
            isEnabled: false, // Default to disabled
            isRemoved: false,
            lastSyncAt: new Date(),
            createdBy: userId,
          })
          
          mergedEmployees.push({
            id: newEmployeeId,
            simproEmployeeId: empId,
            name: providerEmp.name,
            email: providerEmp.email || null,
            isEnabled: false,
            isRemoved: false,
            lastSyncAt: new Date(),
            wasJustAdded: true,
          })
        }
      }
      
      // 5. Mark missing employees as removed (but keep records)
      const removedEmployees = localEmployees.filter(
        local => !currentProviderIds.has(local.simproEmployeeId) && !local.isRemoved
      )
      
      for (const removedEmp of removedEmployees) {
        await db
          .update(organizationEmployees)
          .set({
            isRemoved: true,
            isEnabled: false, // Automatically disable removed employees
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(organizationEmployees.id, removedEmp.id))
        
        mergedEmployees.push({
          id: removedEmp.id,
          simproEmployeeId: removedEmp.simproEmployeeId,
          name: removedEmp.simproEmployeeName,
          email: removedEmp.simproEmployeeEmail,
          isEnabled: false, // Removed employees are always disabled
          isRemoved: true,
          lastSyncAt: new Date(),
          wasJustRemoved: true,
        })
      }
      
      return mergedEmployees
    } catch (error) {
      console.error('Error syncing employees from provider:', error)
      throw error
    }
  }

  /**
   * Get employees for organization (from local DB with current sync status)
   */
  async getEmployeesForOrganization(organizationId: string): Promise<MergedEmployee[]> {
    const employees = await db
      .select()
      .from(organizationEmployees)
      .where(eq(organizationEmployees.organizationId, organizationId))
    
    return employees.map(emp => ({
      id: emp.id,
      simproEmployeeId: emp.simproEmployeeId,
      name: emp.simproEmployeeName,
      email: emp.simproEmployeeEmail,
      isEnabled: emp.isEnabled,
      isRemoved: emp.isRemoved,
      lastSyncAt: emp.lastSyncAt,
    }))
  }

  /**
   * Toggle employee enabled status for bookings
   */
  async toggleEmployeeEnabled(
    organizationId: string,
    employeeId: string,
    enabled: boolean
  ): Promise<void> {
    await db
      .update(organizationEmployees)
      .set({
        isEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationEmployees.id, employeeId),
          eq(organizationEmployees.organizationId, organizationId)
        )
      )
  }
}

// Export singleton instance
export const employeeSyncService = new EmployeeSyncService()