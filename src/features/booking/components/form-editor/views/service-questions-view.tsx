import React, { useCallback } from "react";
import FormEditorBreadcrumb from "@/features/booking/components/form-editor/form-editor-breadcrumb";
import { TitleWithBack } from "../components/title-with-back";
import { FormFieldConfig, FormFieldType } from "@/features/booking/lib/form-field-types";
import { QuestionList } from "../question-list";
import type { FlowNode } from "../form-flow-tree";
import type { NavigationLevel } from "../hooks/use-form-editor-state";

interface ServiceQuestionsViewProps {
    node: FlowNode;
    onNavigateBack: () => void;
    currentLevel?: NavigationLevel;
    onNavigate?: (level: NavigationLevel) => void;
    onUpdateNode: (nodeId: string, updates: Partial<FlowNode>) => void;
    onOptionValueChange?: (questionId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) => void;
    onFieldTypeChange?: (fieldId: string, oldType: FormFieldType, newType: FormFieldType) => void;
    baseQuestions?: FormFieldConfig[];
}

/**
 * Service Questions view for managing service-specific questions
 */
export function ServiceQuestionsView({
    node,
    onNavigateBack,
    currentLevel = 'service-questions',
    onNavigate,
    onUpdateNode,
    onOptionValueChange,
    onFieldTypeChange,
    baseQuestions
}: ServiceQuestionsViewProps) {
    // Get additionalQuestions as FormFieldConfig[] with fallback to empty array
    const serviceQuestions = (node.additionalQuestions || []) as FormFieldConfig[];

    // Handle changes to questions
    const handleQuestionsChange = useCallback((updatedFields: FormFieldConfig[]) => {
        onUpdateNode(node.id, {
            additionalQuestions: updatedFields
        });
    }, [node.id, onUpdateNode]);

    return (
        <div className="flex flex-col h-full">
            <FormEditorBreadcrumb
                currentLevel={currentLevel}
                selectedNode={node}
                onNavigate={onNavigate || onNavigateBack}
                className="self-start"
            />

            <div className="mb-4">
                <TitleWithBack
                    title="Service Questions"
                    currentLevel={currentLevel}
                    selectedNode={node}
                    onNavigateBack={onNavigateBack}
                />
                <p className="text-muted-foreground">
                    These questions are shown when this specific service is selected.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
                <QuestionList
                    questions={serviceQuestions}
                    baseQuestions={baseQuestions}
                    onUpdateQuestions={handleQuestionsChange}
                    onOptionValueChange={onOptionValueChange}
                    onFieldTypeChange={onFieldTypeChange}
                />
            </div>
        </div>
    );
}

export default ServiceQuestionsView;