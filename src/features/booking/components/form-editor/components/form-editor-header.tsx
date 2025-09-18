import React from "react";
import {
    ChevronLeft,
    Code,
    MoreVertical,
    SquareArrowOutUpRightIcon,
    Trash2Icon,
    AlertCircle,
} from "lucide-react";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/tooltip";
import { SaveStatusIndicator } from "@/components/save-status-indicator";
import { ValidationResult } from "../utils/form-validation";
import { ValidationSummaryDialog } from "./validation-summary-dialog";
import { NavigationLevel } from "../hooks/use-form-editor-state";

interface FormEditorHeaderProps {
    formName: string;
    isEnabled: boolean;
    isMobile: boolean;
    onToggleEnabled?: () => void;
    onExit: () => void;
    onOpenPreview: () => void;
    onEmbed: () => void;
    onDelete: () => void;
    // Auto-save state
    isSaving?: boolean;
    lastSaved?: Date | null;
    isDirty?: boolean;
    errors?: string[];
    onSaveNow?: () => Promise<void>;
    // URL props
    formUrl?: string;
    // Validation state
    validationResult?: ValidationResult | null;
    canSave?: boolean;
    saveBlockedReason?: string;
    // Navigation
    onNavigateToIssue?: (level: NavigationLevel, nodeId?: string) => void;
}

/**
 * Header component for the form editor with navigation and actions
 */
export function FormEditorHeader({
    formName,
    isEnabled,
    isMobile,
    onToggleEnabled,
    onExit,
    onOpenPreview,
    onEmbed,
    onDelete,
    isSaving = false,
    lastSaved = null,
    isDirty = false,
    errors = [],
    onSaveNow = async () => { },
    formUrl,
    validationResult = null,
    canSave = true,
    saveBlockedReason,
    onNavigateToIssue
}: FormEditorHeaderProps) {
    // Check if form can be enabled (has no validation errors)
    const canEnable = !validationResult || validationResult.isValid;
    const hasValidationErrors = validationResult && validationResult.errors.length > 0;
    const errorCount = validationResult?.errors.length || 0;
    const totalIssues = validationResult?.errors.length || 0;

    // State for validation dialog
    const [showValidationDialog, setShowValidationDialog] = React.useState(false);
    return (
        <div className="flex items-center justify-between p-4 md:px-6 lg:px-8 border-b md:pb-6 md:border-none">
            {isMobile ? (
                <>
                    <Button variant="outline" onClick={onExit}>
                        <ChevronLeft className="h-4 w-4" />
                        Exit
                    </Button>

                    <div className="flex items-center gap-3">
                        {/* Save Status Indicator */}
                        <SaveStatusIndicator
                            isSaving={isSaving}
                            lastSaved={lastSaved}
                            isDirty={isDirty}
                            errors={errors}
                            className="text-sm"
                            validationResult={validationResult}
                            canSave={canSave}
                            saveBlockedReason={saveBlockedReason}
                            isFormEnabled={isEnabled}
                        />

                        <div className="flex items-center space-x-2">
                            <Label htmlFor="form-enabled-desktop" className="text-sm">Enabled:</Label>
                            <Switch
                                id="form-enabled-desktop"
                                checked={isEnabled}
                                onCheckedChange={canEnable ? onToggleEnabled : undefined}
                                disabled={!canEnable && !isEnabled}
                                title={!canEnable ? `Cannot enable: ${errorCount} validation error${errorCount > 1 ? 's' : ''}` : undefined}
                            />
                        </div>

                        {totalIssues > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowValidationDialog(true)}
                                className="text-sm"
                            >
                                <AlertCircle className="h-4 w-4 mr-2" />
                                {totalIssues} Issue{totalIssues > 1 ? 's' : ''}
                            </Button>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">More</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={isEnabled ? onOpenPreview : undefined}
                                    disabled={!isEnabled}
                                >
                                    <SquareArrowOutUpRightIcon className="h-4 w-4 mr-2" />
                                    Open
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onEmbed}>
                                    <Code className="h-4 w-4 mr-2" />
                                    Embed
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onDelete} variant="destructive">
                                    <Trash2Icon className="h-4 w-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex items-center space-x-4">
                        <Button variant="outline" onClick={onExit}>
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Exit
                        </Button>

                        <h1 className="text-sm font-medium">{formName}</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Validation Issues Button - to the left of save status */}
                        {totalIssues > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowValidationDialog(true)}
                                className="text-sm"
                            >
                                <AlertCircle className="h-4 w-4 mr-2" />
                                {totalIssues} Issue{totalIssues > 1 ? 's' : ''}
                            </Button>
                        )}

                        {/* Save Status Indicator */}
                        <SaveStatusIndicator
                            isSaving={isSaving}
                            lastSaved={lastSaved}
                            isDirty={isDirty}
                            errors={errors}
                            className="text-sm"
                            validationResult={validationResult}
                            canSave={canSave}
                            saveBlockedReason={saveBlockedReason}
                            isFormEnabled={isEnabled}
                        />

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span tabIndex={0}>
                                        <Button
                                            variant="ghost"
                                            onClick={isEnabled ? onOpenPreview : undefined}
                                            disabled={!isEnabled}
                                        >
                                            <SquareArrowOutUpRightIcon className="h-4 w-4 mr-2" />
                                            <span>Open</span>
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                {!isEnabled && (
                                    <TooltipContent>
                                        <p>Enable the form to open it</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>

                        <div className="flex items-center space-x-2 bg-muted px-4 py-1 rounded-md self-stretch">
                            <span className="text-sm font-medium">Enabled:</span>
                            <Switch
                                id="form-enabled-mobile"
                                checked={isEnabled}
                                onCheckedChange={canEnable ? onToggleEnabled : undefined}
                                disabled={!canEnable && !isEnabled}
                                title={!canEnable ? `Cannot enable: ${errorCount} validation error${errorCount > 1 ? 's' : ''}` : undefined}
                            />
                        </div>

                        <Button variant="secondary" onClick={onEmbed}>
                            <Code className="h-4 w-4 mr-2" />
                            <span>Embed</span>
                        </Button>
                    </div>
                </>
            )}

            {/* Validation Summary Dialog */}
            <ValidationSummaryDialog
                open={showValidationDialog}
                onOpenChange={setShowValidationDialog}
                validationResult={validationResult}
                onNavigateToIssue={onNavigateToIssue}
            />
        </div>
    );
}

export default FormEditorHeader;