import React from "react";
import {
    ReceiptTextIcon,
    HardHatIcon,
    SlidersHorizontalIcon,
    MessageCircleQuestionIcon
} from "lucide-react";
import FormEditorBreadcrumb from "@/features/booking/components/form-editor/form-editor-breadcrumb";
import type { ServiceDetailView, NavigationLevel } from "../hooks/use-form-editor-state";
import type { FlowNode } from "../form-flow-tree";
import useFormEditorData from "../hooks/use-form-editor-data";

interface ServiceOptionsViewProps {
    node: FlowNode;
    onNavigateBack: () => void;
    onNavigateToDetail: (view: ServiceDetailView) => void;
    activeView?: ServiceDetailView;
    currentLevel?: NavigationLevel;
    onNavigate?: (level: NavigationLevel) => void;
}

/**
 * Service options menu view showing main detail navigation options
 */
export function ServiceOptionsView({
    node,
    onNavigateBack,
    onNavigateToDetail,
    activeView = "details",
    currentLevel = 'service-details',
    onNavigate,
    onUpdateNode
}: ServiceOptionsViewProps) {
    // Access form data context - not actively used in this view but available for future enhancements
    const { data } = useFormEditorData();

    if (!node) return null;

    return (
        <>
            <FormEditorBreadcrumb
                currentLevel={currentLevel}
                selectedNode={node}
                onNavigate={onNavigate || onNavigateBack}
                className="self-start"
            />
            <h2 className="text-2xl font-bold mb-6">{node.label}</h2>

            <div className="flex flex-col space-y-4">
                <button
                    onClick={() => onNavigateToDetail("details")}
                    className={`w-full flex items-start p-4 text-left hover:bg-muted/50 rounded-md ${activeView === 'details' ? 'bg-muted/50' : ''}`}
                >
                    <ReceiptTextIcon className="h-5 w-5 mr-4 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="font-medium">Service Details</div>
                        <div className="text-muted-foreground text-sm">
                            Edit service title, description, and basic information.
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => onNavigateToDetail("employees")}
                    className={`w-full flex items-start p-4 text-left hover:bg-muted/50 rounded-md ${activeView === 'employees' ? 'bg-muted/50' : ''}`}
                >
                    <HardHatIcon className="h-5 w-5 mr-4 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="font-medium">Employees</div>
                        <div className="text-muted-foreground text-sm">
                            Assign employees who can perform this service.
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => onNavigateToDetail("scheduling")}
                    className={`w-full flex items-start p-4 text-left hover:bg-muted/50 rounded-md ${activeView === 'scheduling' ? 'bg-muted/50' : ''}`}
                >
                    <SlidersHorizontalIcon className="h-5 w-5 mr-4 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="font-medium">Scheduling Settings</div>
                        <div className="text-muted-foreground text-sm">
                            Configure duration, buffer times, and availability.
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => onNavigateToDetail("questions")}
                    className={`w-full flex items-start p-4 text-left hover:bg-muted/50 rounded-md ${activeView === 'questions' ? 'bg-muted/50' : ''}`}
                >
                    <MessageCircleQuestionIcon className="h-5 w-5 mr-4 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="font-medium">Additional Questions</div>
                        <div className="text-muted-foreground text-sm">
                            Add custom questions specific to this service.
                        </div>
                    </div>
                </button>
            </div>
        </>
    );
}

export default ServiceOptionsView;