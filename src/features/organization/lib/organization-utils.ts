/**
 * Organization utility functions
 * 
 * Centralized functions for managing organization state across the application.
 * Handles per-tab sessions (sessionStorage) with fallback to localStorage for new tabs.
 */

/**
 * Sets the active organization ID in both sessionStorage (per-tab) and localStorage (cross-tab fallback)
 * Also dispatches a custom event to notify components in the same tab
 * 
 * @param organizationId - The ID of the organization to set as active
 */
export function setActiveOrganizationId(organizationId: string): void {
  if (typeof window === 'undefined') return;
  
  // Update both storages
  sessionStorage.setItem('activeOrganizationId', organizationId);
  localStorage.setItem('activeOrganizationId', organizationId);
  
  // Notify other components in same tab
  window.dispatchEvent(new CustomEvent('org-changed', { detail: organizationId }));
}

/**
 * Gets the active organization ID from storage
 * Priority: sessionStorage (tab-specific) → localStorage (fallback)
 * 
 * @returns The active organization ID or null if not set
 */
export function getActiveOrganizationId(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Priority: sessionStorage (tab-specific) → localStorage (fallback)
  const sessionOrgId = sessionStorage.getItem('activeOrganizationId');
  const localOrgId = localStorage.getItem('activeOrganizationId');
  
  return sessionOrgId || localOrgId;
}

/**
 * Clears the active organization from storage
 * Useful when user logs out or needs to reset organization selection
 */
export function clearActiveOrganizationId(): void {
  if (typeof window === 'undefined') return;
  
  sessionStorage.removeItem('activeOrganizationId');
  localStorage.removeItem('activeOrganizationId');
  
  // Notify other components in same tab
  window.dispatchEvent(new CustomEvent('org-changed', { detail: null }));
}