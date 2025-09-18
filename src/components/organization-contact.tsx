import React from 'react';
import { Phone, Mail } from 'lucide-react';
import { Button } from '@/ui/button';

export interface OrganizationContactProps {
  organizationName?: string;
  organizationPhone?: string | null;
  organizationEmail?: string | null;
  variant?: 'buttons' | 'inline' | 'list';
  showLabel?: boolean;
  className?: string;
}

/**
 * Reusable component to display organization contact information
 * Intelligently handles all combinations of phone/email availability
 */
export function OrganizationContact({
  organizationName,
  organizationPhone,
  organizationEmail,
  variant = 'buttons',
  showLabel = true,
  className = ''
}: OrganizationContactProps) {
  const hasPhone = organizationPhone && organizationPhone.trim() !== '';
  const hasEmail = organizationEmail && organizationEmail.trim() !== '';
  const hasAnyContact = hasPhone || hasEmail;

  if (!hasAnyContact) {
    return (
      <div className={`text-muted-foreground text-sm ${className}`}>
        Please contact {organizationName || 'the company'} directly for assistance.
      </div>
    );
  }

  if (variant === 'buttons') {
    return (
      <div className={className}>
        {showLabel && (
          <p className="text-muted-foreground text-sm mb-3">
            Please contact {organizationName || 'our company'}:
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {hasPhone && (
            <Button asChild variant="default" size="sm">
              <a href={`tel:${organizationPhone}`}>
                <Phone className="h-4 w-4 mr-2" />
                Call {organizationPhone}
              </a>
            </Button>
          )}
          {hasEmail && (
            <Button asChild variant="default" size="sm">
              <a href={`mailto:${organizationEmail}?subject=Booking Inquiry`}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    const contactParts = [];
    if (hasPhone) {
      contactParts.push(
        <a key="phone" href={`tel:${organizationPhone}`} className="text-primary hover:underline">
          {organizationPhone}
        </a>
      );
    }
    if (hasEmail) {
      contactParts.push(
        <a key="email" href={`mailto:${organizationEmail}`} className="text-primary hover:underline">
          {organizationEmail}
        </a>
      );
    }

    return (
      <div className={`text-sm ${className}`}>
        {showLabel && <span>Contact: </span>}
        {contactParts.reduce((prev: React.ReactNode[], curr, i) => {
          if (i === 0) return [curr];
          return [...prev, ' or ', curr];
        }, [])}
      </div>
    );
  }

  // variant === 'list'
  return (
    <div className={className}>
      {showLabel && (
        <p className="text-muted-foreground text-sm mb-2">
          Contact {organizationName || 'us'}:
        </p>
      )}
      <div className="space-y-2">
        {hasPhone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a href={`tel:${organizationPhone}`} className="text-primary hover:underline">
              {organizationPhone}
            </a>
          </div>
        )}
        {hasEmail && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a href={`mailto:${organizationEmail}`} className="text-primary hover:underline">
              {organizationEmail}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Helper function to create error messages with contact information
 */
export function getContactErrorMessage(
  baseMessage: string,
  organizationName?: string,
  organizationPhone?: string | null,
  organizationEmail?: string | null
): string {
  const hasPhone = organizationPhone && organizationPhone.trim() !== '';
  const hasEmail = organizationEmail && organizationEmail.trim() !== '';

  if (!hasPhone && !hasEmail) {
    return `${baseMessage} Please contact ${organizationName || 'the company'} directly for assistance.`;
  }

  let contactInfo = `${baseMessage} Please contact ${organizationName || 'us'}`;

  if (hasPhone && hasEmail) {
    contactInfo += ` at ${organizationPhone} or ${organizationEmail}`;
  } else if (hasPhone) {
    contactInfo += ` at ${organizationPhone}`;
  } else if (hasEmail) {
    contactInfo += ` at ${organizationEmail}`;
  }

  contactInfo += ' for assistance.';

  return contactInfo;
}