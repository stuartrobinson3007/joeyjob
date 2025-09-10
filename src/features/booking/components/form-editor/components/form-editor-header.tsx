import React from "react";
import {
    ChevronLeft,
    Code,
    MoreVertical,
    SquareArrowOutUpRightIcon,
    Trash2Icon,
} from "lucide-react";
import { Button } from "@/ui/button";
import { Switch } from "@/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { SaveStatusIndicator } from "@/components/save-status-indicator";

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
    onSaveNow = async () => {}
}: FormEditorHeaderProps) {
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
                        />
                        
                        <div className="text-sm flex items-center">
                            Enabled:
                            <Switch
                                checked={isEnabled}
                                onCheckedChange={onToggleEnabled}
                                className="ml-2 relative top-[1px]"
                            />
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">More</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={onOpenPreview}>
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

                        <div className="flex items-center">
                            <div className="mr-2">Flows</div>
                            <ChevronLeft className="h-4 w-4 rotate-180" />
                            <div className="ml-2 font-medium">{formName}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Save Status Indicator */}
                        <SaveStatusIndicator
                            isSaving={isSaving}
                            lastSaved={lastSaved}
                            isDirty={isDirty}
                            errors={errors}
                            className="text-sm"
                        />
                        
                        <div className="flex items-center">
                            <span className="mr-2">Enabled:</span>
                            <Switch
                                checked={isEnabled}
                                onCheckedChange={onToggleEnabled}
                            />
                        </div>

                        <Button variant="ghost" onClick={onOpenPreview}>
                            <SquareArrowOutUpRightIcon className="h-4 w-4 mr-2" />
                            <span>Open</span>
                        </Button>

                        <Button variant="secondary" onClick={onEmbed}>
                            <Code className="h-4 w-4 mr-2" />
                            <span>Embed</span>
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}

export default FormEditorHeader;