import { useCallback } from "react";
import FormEditorBreadcrumb from "@/features/booking/components/form-editor/form-editor-breadcrumb";
import { TitleWithBack } from "../components/title-with-back";
import useFormEditorData from "../hooks/use-form-editor-data";
import { FormFieldConfig, FormFieldType } from "@/features/booking/lib/form-field-types";
import { QuestionList } from "../question-list";
import type { NavigationLevel } from "../hooks/use-form-editor-state";

interface QuestionsViewProps {
    onNavigateBack: () => void;
    currentLevel?: NavigationLevel;
    onNavigate?: (level: NavigationLevel) => void;
    onOptionValueChange?: (questionId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) => void;
    onFieldTypeChange?: (fieldId: string, oldType: FormFieldType, newType: FormFieldType) => void;
}

/**
 * Questions view for managing form questions
 */
export function QuestionsView({
    onNavigateBack,
    currentLevel = 'questions',
    onNavigate,
    onOptionValueChange,
    onFieldTypeChange
}: QuestionsViewProps) {
    const { data, dispatch } = useFormEditorData();

    // Handle changes to questions
    const handleQuestionsChange = useCallback((updatedFields: FormFieldConfig[]) => {
        // Update the state directly with the new fields
        dispatch({
            type: 'UPDATE_BASE_QUESTIONS',
            payload: updatedFields
        });
    }, [dispatch]);

    return (
        <div className="flex flex-col h-full">
            <FormEditorBreadcrumb
                currentLevel={currentLevel}
                onNavigate={onNavigate || onNavigateBack}
                className="self-start"
            />
            <TitleWithBack
                title="Questions"
                currentLevel={currentLevel}
                onNavigateBack={onNavigateBack}
                className="mb-4"
            />
            <div className="flex-1 overflow-y-auto pr-1">
                <QuestionList
                    questions={data.baseQuestions}
                    onUpdateQuestions={handleQuestionsChange}
                    onOptionValueChange={onOptionValueChange}
                    onFieldTypeChange={onFieldTypeChange}
                />
            </div>
        </div>
    );
}

export default QuestionsView;