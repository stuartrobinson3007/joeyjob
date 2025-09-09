import React, { useCallback } from "react";
import BackButton from "@/features/booking/components/form-editor/back-button";
import { FormFieldConfig, FormFieldType } from "@/features/booking/lib/form-field-types";
import { QuestionList } from "@/components/question-list";
import type { FlowNode } from "@/components/FormFlowTree";

interface ServiceQuestionsViewProps {
    node: FlowNode;
    onNavigateBack: () => void;
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
            <BackButton
                label="Service configuration"
                onClick={onNavigateBack}
                className="self-start"
            />

            <div className="mb-4">
                <h2 className="text-2xl font-bold">Service Questions</h2>
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