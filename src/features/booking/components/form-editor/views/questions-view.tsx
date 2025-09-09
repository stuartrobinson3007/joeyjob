import { useCallback } from "react";
import BackButton from "@/features/booking/components/form-editor/back-button";
import useFormEditorData from "../hooks/useFormEditorData";
import { FormFieldConfig, FormFieldType } from "@/features/booking/lib/form-field-types";
import { QuestionList } from "@/components/question-list";

interface QuestionsViewProps {
    onNavigateBack: () => void;
    onOptionValueChange?: (questionId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) => void;
    onFieldTypeChange?: (fieldId: string, oldType: FormFieldType, newType: FormFieldType) => void;
}

/**
 * Questions view for managing form questions
 */
export function QuestionsView({
    onNavigateBack,
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
            <BackButton
                label="All settings"
                onClick={onNavigateBack}
                className="self-start"
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