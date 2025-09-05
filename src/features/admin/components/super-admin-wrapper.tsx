/**
 * Super Admin Wrapper Component
 * 
 * Wraps the entire application with a purple border and admin controls strip
 * when the super admin is impersonating another user. Provides visual indication 
 * and quick access to exit impersonation functionality.
 */

import { ShieldUser, X } from 'lucide-react';
import { authClient } from '@/lib/auth/auth-client';
import { useCallback, useMemo, memo } from 'react';
import { useSession } from '@/lib/auth/auth-hooks';

// Corner mask SVG component for creating rounded corner illusion
const CornerMask = ({
  corner,
  size = 10
}: {
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: number;
}) => {
  const positions = {
    'top-left': 'top-[40px] left-[5px]',
    'top-right': 'top-[40px] right-[5px]',
    'bottom-left': 'bottom-[5px] left-[5px]',
    'bottom-right': 'bottom-[5px] right-[5px]'
  };

  const paths = {
    'top-left': `M ${size},0 A ${size},${size} 0 0,0 0,${size} L 0,0 Z`,
    'top-right': `M ${size},${size} A ${size},${size} 0 0,0 0,0 L ${size},0 Z`,
    'bottom-left': `M 0,0 A ${size},${size} 0 0,0 ${size},${size} L 0,${size} Z`,
    'bottom-right': `M 0,${size} A ${size},${size} 0 0,0 ${size},0 L ${size},${size} Z`
  };

  return (
    <svg
      className={`absolute ${positions[corner]} pointer-events-none`}
      width={size}
      height={size}
      style={{ zIndex: 51 }}
    >
      <path
        d={paths[corner]}
        className='fill-purple-700'
      />
    </svg>
  );
};

interface SuperAdminButton {
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}

const SuperAdminButton = ({ onClick, title, children }: SuperAdminButton) => (
  <button
    onClick={onClick}
    title={title}
    className="flex items-center justify-center w-8 h-8 bg-purple-600 hover:bg-purple-500 rounded-md transition-colors duration-200 text-white"
  >
    {children}
  </button>
);

export interface SuperAdminWrapperProps {
  isSuperAdmin: boolean;
  user?: any; // Use any to match better-auth user type
  isImpersonating?: boolean;
  impersonatedUser?: any; // Use any to match better-auth user type
  onExitImpersonation?: () => void;
  onOpenSettings?: () => void;
}

export const SuperAdminWrapper = memo(function SuperAdminWrapper({
  isSuperAdmin,
  isImpersonating = false,
  impersonatedUser,
  onExitImpersonation,
  onOpenSettings,
}: SuperAdminWrapperProps) {

  // Show frame when superadmin is impersonating a user
  const shouldShowFrame = isSuperAdmin && isImpersonating;

  if (!shouldShowFrame) {
    return null;
  }

  console.log('🎭 [SuperAdminWrapper] Should show super admin frame')

  const displayName = `${impersonatedUser?.firstName || ''} ${impersonatedUser?.lastName || ''}`.trim() || impersonatedUser?.email;

  const handleExitClick = () => {

    if (onExitImpersonation) {
      onExitImpersonation();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none outline outline-purple-700 outline-5 -outline-offset-5"
    >
      {/* Corner masks for rounded corner illusion */}
      <CornerMask corner="top-left" />
      <CornerMask corner="top-right" />
      <CornerMask corner="bottom-left" />
      <CornerMask corner="bottom-right" />

      {/* Super admin controls strip - only this part accepts pointer events */}
      <div
        className="bg-purple-700 text-white px-5 py-2 flex items-center justify-between pointer-events-auto"
        style={{
          height: '40px',
        }}
      >
        {/* Left side - Super Admin indicator */}
        <div className="flex items-center gap-2 text-sm">
          <ShieldUser className='size-5' />
          <div className="flex items-center gap-2 bg-purple-950 py-1 px-2.5 rounded-md text-purple-50">
            <span className="font-medium">Impersonating {displayName}</span>
          </div>
        </div>

        {/* Right side - Super Admin controls */}
        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <SuperAdminButton onClick={onOpenSettings}>
              ⚙️
            </SuperAdminButton>
          )}
          <SuperAdminButton
            onClick={handleExitClick}
            title="Exit impersonation and return to users table"
          >
            <X className="h-4 w-4" />
          </SuperAdminButton>
        </div>
      </div>
    </div>
  );
});

/**
 * Hook to manage super admin wrapper state and detection using better-auth
 * NOTE: Only call this hook when session is already loaded (not isPending)
 */
export function useSuperAdminWrapper() {
  // Session should already be loaded when this hook is called
  const { data: session } = useSession();

  // Handle exit impersonation - stable function
  const handleExitImpersonation = useCallback(async () => {
    try {
      await authClient.admin.stopImpersonating();
      window.location.href = '/superadmin/users';
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
    }
  }, []);

  // Check admin status
  const isSuperAdmin = session?.user?.role === 'superadmin';
  const isImpersonating = !!session?.session?.impersonatedBy;

  // Stable memoization with only primitive dependencies
  const result = useMemo(() => ({
    isSuperAdmin,
    isImpersonating,
    impersonatedUser: isImpersonating ? session?.user : undefined,
    user: session?.user,
    onExitImpersonation: handleExitImpersonation,
    shouldShowSuperAdminFrame: isSuperAdmin && isImpersonating,
    superAdminBarHeight: 40,
  }), [
    isSuperAdmin,
    isImpersonating,
    session?.user?.id,  // Use ID instead of full object
    session?.user?.role,
    session?.session?.impersonatedBy,
    handleExitImpersonation
  ]);

  return result;
}