/**
 * Organization Switcher Component
 * 
 * Allows users to switch between workspaces (organizations in better-auth) they belong to.
 * Integrates with better-auth organization system and the existing organization context.
 */

import { useState, memo, useCallback } from 'react';
import { Check, ChevronsUpDown, Plus, Loader2, Building2, Lock } from 'lucide-react';
import { Button } from '@/components/taali-ui/ui/button';
import { toast } from 'sonner';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/taali-ui/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/taali-ui/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/taali-ui/ui/popover';
import { Input } from '@/components/taali-ui/ui/input';
import { Label } from '@/components/taali-ui/ui/label';
import { Textarea } from '@/components/taali-ui/ui/textarea';
import { Skeleton } from '@/components/taali-ui/ui/skeleton';
import { authClient } from '@/lib/auth/auth-client';
import { useActiveOrganization } from '@/features/organization/lib/organization-context';
import { useSuperAdminWrapper } from '../../admin/components/super-admin-wrapper';

// Memoized OrganizationSwitcher to prevent re-renders on form state changes
const OrganizationSwitcher = memo(function OrganizationSwitcher() {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Form state for creating new organizations
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    industry: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Use better-auth organization hooks (organizations = workspaces in our UI)
  const { data: organizations, isPending: isLoading } = authClient.useListOrganizations();
  const { activeOrganization, setActiveOrganization, isLoading: orgContextLoading } = useActiveOrganization();
  
  // Track switching state
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingToWorkspace, setSwitchingToWorkspace] = useState<string | null>(null);
  
  // Check superadmin context for disable logic
  const { shouldShowSuperAdminFrame, isImpersonating } = useSuperAdminWrapper();
  const shouldDisableOrganizationSwitcher = shouldShowSuperAdminFrame && !isImpersonating;
  
  // Memoized event handlers to prevent breaking memoization
  const handleCreateWorkspace = useCallback(async () => {
    if (!formData.name.trim()) {
      setValidationErrors({ name: 'Workspace name is required' });
      return;
    }

    setValidationErrors({});
    setIsCreating(true);

    try {
      const { data: result, error } = await authClient.organization.create({
        name: formData.name.trim(),
        slug: formData.name.trim().toLowerCase().replace(/\s+/g, '-'), // Generate slug from name
        // Note: better-auth organization.create might not support description field
      });

      if (error) {
        throw new Error(error.message || 'Failed to create organization');
      }

      if (result) {
        // Switch to the newly created organization
        setActiveOrganization(result.id);
        
        // Reset form and close dialog
        setFormData({ name: '', description: '', industry: '' });
        setShowCreateDialog(false);
        
        // Show success toast
        toast.success(`Workspace "${result.name}" created successfully`);
      }
    } catch (error: any) {
      console.error('Failed to create workspace:', error);
      const errorMessage = error?.message || 'Failed to create workspace';
      setValidationErrors({ 
        name: errorMessage 
      });
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [formData, setActiveOrganization]);

  const handleWorkspaceSelect = useCallback(async (organizationId: string) => {
    if (organizationId === activeOrganization?.id) {
      setOpen(false);
      return;
    }

    try {
      setIsSwitching(true);
      setSwitchingToWorkspace(organizationId);
      
      await setActiveOrganization(organizationId);
      setOpen(false);
      
      // Show success toast
      const targetOrg = organizations?.find(org => org.id === organizationId);
      if (targetOrg) {
        toast.success(`Switched to "${targetOrg.name}"`);
      }
    } catch (error: any) {
      console.error('Failed to switch workspace:', error);
      toast.error(error?.message || 'Failed to switch workspace');
    } finally {
      setIsSwitching(false);
      setSwitchingToWorkspace(null);
    }
  }, [activeOrganization?.id, organizations, setActiveOrganization]);

  const updateFormField = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [validationErrors]);

  if (isLoading || orgContextLoading) {
    return (
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-4" />
      </div>
    );
  }

  // Show disabled state when in superadmin mode (except when impersonating)
  if (shouldDisableOrganizationSwitcher) {
    return (
      <Button
        variant="outline"
        className="w-full justify-between opacity-50 cursor-not-allowed"
        disabled={true}
        title="Workspace switching disabled in superadmin mode"
      >
        {activeOrganization ? (
          <span className="text-sm font-medium truncate flex-1 text-left">
            {activeOrganization.name}
          </span>
        ) : (
          <div className="flex items-center space-x-2">
            <Building2 className="h-4 w-4" />
            <span>Select workspace</span>
          </div>
        )}
        <Lock className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select workspace"
            className={`w-full justify-between ${isSwitching ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={isCreating || isSwitching}
          >
            {activeOrganization ? (
              <span className="text-sm font-medium truncate flex-1 text-left">
                {activeOrganization.name}
              </span>
            ) : (
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4" />
                <span>Select workspace</span>
              </div>
            )}
            {isCreating || isSwitching ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search workspaces..." />
            <CommandList>
              <CommandEmpty>No workspaces found.</CommandEmpty>
              {organizations && organizations.length > 0 && (
                <CommandGroup>
                  {organizations.map((organization) => (
                    <CommandItem
                      key={organization.id}
                      value={`${organization.id}-${organization.name}`}
                      onSelect={() => handleWorkspaceSelect(organization.id)}
                      className="flex items-center space-x-2"
                    >
                      <span className="text-sm font-medium truncate flex-1">
                        {organization.name}
                      </span>
                      {switchingToWorkspace === organization.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : activeOrganization?.id === organization.id ? (
                        <Check className="h-4 w-4" />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="create-workspace"
                onSelect={() => {
                  setOpen(false);
                  setShowCreateDialog(true);
                }}
                className="flex items-center space-x-2"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed">
                  <Plus className="h-4 w-4" />
                </div>
                <span>Create workspace</span>
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Workspace Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace to collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Workspace name</Label>
              <Input
                id="name"
                placeholder="Acme Inc"
                value={formData.name}
                onChange={(e) => updateFormField('name', e.target.value)}
                className={validationErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="A brief description of your workspace"
                value={formData.description}
                onChange={(e) => updateFormField('description', e.target.value)}
                className={validationErrors.description ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {validationErrors.description && (
                <p className="text-sm text-destructive">{validationErrors.description}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setFormData({ name: '', description: '', industry: '' });
                setValidationErrors({});
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              disabled={!formData.name.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Create workspace
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

export { OrganizationSwitcher };
export default OrganizationSwitcher;