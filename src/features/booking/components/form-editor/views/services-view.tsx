import React from "react";
import FormEditorBreadcrumb from "@/features/booking/components/form-editor/form-editor-breadcrumb";
import { TitleWithBack } from "../components/title-with-back";
import useFormEditorData from "../hooks/use-form-editor-data";
import { Button } from "@/ui/button";
import { PlusIcon, CalendarIcon, Users } from "lucide-react";
import type { NavigationLevel } from "../hooks/use-form-editor-state";
import type { ValidationResult } from "../utils/form-validation";

interface ServicesViewProps {
    onNavigateBack: () => void;
    servicesContent: React.ReactNode;
    onAddService?: () => void;
    onAddGroup?: () => void;
    currentLevel?: NavigationLevel;
    onNavigate?: (level: NavigationLevel) => void;
}

/**
 * Services view showing the service tree
 */
export function ServicesView({
    onNavigateBack,
    servicesContent,
    onAddService,
    onAddGroup,
    currentLevel = 'services',
    onNavigate
}: ServicesViewProps) {
    const { data } = useFormEditorData();

    // Check if there are any services (children of the root start node)
    const hasServices = data.serviceTree.children && data.serviceTree.children.length > 0;

    return (
        <>
            <FormEditorBreadcrumb
                currentLevel={currentLevel}
                onNavigate={onNavigate || onNavigateBack}
                className="self-start"
            />
            <TitleWithBack
                title="Services"
                currentLevel={currentLevel}
                onNavigateBack={onNavigateBack}
                className="mb-4"
            />
            <div className="mb-6">
                <p className="text-muted-foreground">
                    Configure the services that customers can book.
                    Customize details, scheduling settings, and questions for each service.
                </p>
            </div>

            {!hasServices ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
                    <div className="relative mb-6">
                        <div className="p-4 bg-primary/10 rounded-full">
                            <CalendarIcon className="h-8 w-8 text-primary" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 p-2 bg-background rounded-full border shadow-sm">
                            <PlusIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No services yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-md">
                        Start by adding your first service or create a group to organize multiple services.
                        Each service can have its own scheduling, pricing, and custom questions.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            onClick={onAddService}
                            className="flex items-center gap-2"
                        >
                            <CalendarIcon className="h-4 w-4" />
                            Add Service
                        </Button>
                        <Button
                            variant="outline"
                            onClick={onAddGroup}
                            className="flex items-center gap-2"
                        >
                            <Users className="h-4 w-4" />
                            Create Group
                        </Button>
                    </div>
                </div>
            ) : (
                servicesContent
            )}
        </>
    );
}

export default ServicesView;