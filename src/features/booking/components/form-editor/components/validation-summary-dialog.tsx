import React from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/ui/dialog';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { ScrollArea } from '@/taali/components/ui/scroll-area';
import { ValidationResult, ValidationIssue, getIssueNavigationPath } from '../utils/form-validation';
import { NavigationLevel } from '../hooks/use-form-editor-state';

interface ValidationSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validationResult: ValidationResult | null;
  onNavigateToIssue?: (level: NavigationLevel, nodeId?: string) => void;
}

/**
 * Dialog component that shows a summary of all validation issues
 * with navigation links to fix each problem
 */
export function ValidationSummaryDialog({
  open,
  onOpenChange,
  validationResult,
  onNavigateToIssue
}: ValidationSummaryDialogProps) {
  if (!validationResult) {
    return null;
  }

  const { errors } = validationResult;
  const totalIssues = errors.length;

  const handleNavigateToIssue = (issue: ValidationIssue) => {
    if (!onNavigateToIssue) return;

    const navigationPath = getIssueNavigationPath(issue);
    onNavigateToIssue(navigationPath.level as NavigationLevel, navigationPath.nodeId);
    onOpenChange(false); // Close dialog after navigation
  };

  const getIssueDescription = (issue: ValidationIssue): string => {
    // Provide more user-friendly descriptions for common issues
    switch (issue.code) {
      case 'SERVICE_NO_EMPLOYEES':
        return 'Service needs at least one assigned employee to accept bookings';
      case 'SERVICE_MISSING_NAME':
        return 'Service must have a name for customers to identify it';
      case 'SERVICE_INVALID_DURATION':
        return 'Service duration must be set to a positive number of minutes';
      case 'SERVICE_INVALID_PRICE':
        return 'Service price cannot be negative (leave empty for no pricing)';
      case 'MISSING_INTERNAL_NAME':
        return 'Form needs an internal name for organization';
      case 'INVALID_SLUG':
      case 'INVALID_SLUG_CHARS':
      case 'INVALID_SLUG_EDGES':
      case 'INVALID_SLUG_DOUBLE_HYPHEN':
        return 'Form URL slug has invalid format (use lowercase letters, numbers, and hyphens)';
      case 'QUESTION_MISSING_LABEL':
        return 'Question needs a label that customers will see';
      case 'QUESTION_NO_OPTIONS':
      case 'QUESTION_EMPTY_OPTIONS':
        return 'Multiple choice question needs options for customers to select';
      default:
        return issue.message;
    }
  };

  const getSectionDisplayName = (section: string): string => {
    switch (section) {
      case 'services': return 'Services';
      case 'questions': return 'Questions';
      case 'branding': return 'Branding';
      case 'metadata': return 'Form Settings';
      default: return section;
    }
  };

  const renderIssueList = (issues: ValidationIssue[]) => {
    if (issues.length === 0) return null;

    return (
      <div className="space-y-3">

        <div className="space-y-2">
          {issues.map((issue, index) => (
            <Button
              key={`${issue.code}-${index}`}
              variant="ghost"
              onClick={() => handleNavigateToIssue(issue)}
              className="w-full h-auto p-3 text-left justify-start"
            >
              <div className="flex items-start justify-between gap-3 w-full">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {getSectionDisplayName(issue.section)}
                    </Badge>
                    {issue.nodeId && (
                      <span className="text-xs text-muted-foreground truncate">
                        {issue.path || `Node ${issue.nodeId}`}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mb-2">
                    {getIssueDescription(issue)}
                  </p>
                </div>

                <div className="flex-shrink-0 flex items-center text-xs text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Form Validation Issues
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {totalIssues === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-medium text-sm mb-1">No Issues Found</h3>
              <p className="text-sm text-muted-foreground">
                Your form configuration is valid and ready to be published.
              </p>
            </div>
          ) : (
            <>

              <ScrollArea className="flex-1 min-h-0" viewportClassName="max-h-[60vh]">
                <div className="space-y-6 ">
                  {renderIssueList(errors)}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}