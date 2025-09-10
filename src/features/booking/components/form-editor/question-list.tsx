import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { PlusIcon } from "lucide-react";
import { FormFieldEditor, fieldTypeIcons, fieldTypeLabels } from "@/features/booking/components/form-editor/form-field-editor";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { Button } from "@/ui/button";
import { TooltipProvider, TooltipTrigger, TooltipContent, Tooltip } from "@/ui/tooltip";
import {
    FormFieldConfig,
    createFieldConfigFromFormFieldType,
    FormFieldType
} from "@/features/booking/lib/form-field-types";
import { cn } from "@/taali/lib/utils";

// Define unique field types that can only be added once
export const uniqueFieldTypes: FormFieldType[] = [
    "contact-info",
    "address"
];

interface QuestionListProps {
    questions: FormFieldConfig[];
    onUpdateQuestions: (questions: FormFieldConfig[]) => void;
    title?: string;
    description?: string;
    actions?: React.ReactNode;
    onNavigateBack?: () => void;
    showBackLink?: boolean;
    onOptionValueChange?: (questionId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) => void;
    onFieldTypeChange?: (fieldId: string, oldType: FormFieldType, newType: FormFieldType) => void;
    baseQuestions?: FormFieldConfig[];
}

// Create a sortable wrapper component for FormFieldEditor
const SortableField = ({
    config,
    id,
    handlers,
    uiState,
    baseQuestions
}: {
    config: FormFieldConfig;
    id: string;
    handlers: {
        onRemove: (id: string) => void;
        onUpdateField?: (id: string, updates: Partial<FormFieldConfig>) => void;
        onToggleOptions: (id: string) => void;
        onOptionValueChange?: (questionId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) => void;
        onFieldTypeChange?: (fieldId: string, oldType: FormFieldType, newType: FormFieldType) => void;
    };
    uiState: {
        showOptions: boolean;
        usedFieldTypes: FormFieldType[];
    };
    baseQuestions?: FormFieldConfig[];
}) => {
    // Use mouse activation constraints to prevent drag from interfering with clicks
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        // Ensure dragged element has highest z-index
        zIndex: isDragging ? 1000 : undefined
    };

    // Use the FormFieldEditor component
    const { onRemove, onUpdateField, onToggleOptions, onOptionValueChange } = handlers;
    const { showOptions, usedFieldTypes } = uiState;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative group",
                isDragging && "z-50"
            )}
        >
            <FormFieldEditor
                config={config}
                showOptions={showOptions}
                onToggleOptions={() => onToggleOptions(id)}
                onRemove={onRemove}
                onUpdateField={onUpdateField!}
                usedFieldTypes={usedFieldTypes}
                baseQuestions={baseQuestions}
                isBeingDragged={isDragging}
                showDragIcon={true}
                dragHandleProps={{
                    attributes,
                    listeners
                }}
                onOptionValueChange={onOptionValueChange}
                onFieldTypeChange={handlers.onFieldTypeChange}
            />
        </div>
    );
};

export const QuestionList: React.FC<QuestionListProps> = ({
    questions: initialQuestions = [],
    onUpdateQuestions,
    onOptionValueChange,
    onFieldTypeChange,
    baseQuestions = []
}) => {
    const [questions, setQuestions] = useState<FormFieldConfig[]>(initialQuestions);
    const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(
        initialQuestions.length > 0 ? initialQuestions[0].id : null
    );
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeQuestion, setActiveQuestion] = useState<FormFieldConfig | null>(null);
    const [previousExpandedId, setPreviousExpandedId] = useState<string | null>(null);

    // Set up DnD sensors with activation constraints
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Sync internal state when the initialQuestions prop changes
    useEffect(() => {
        // Only update if the incoming questions are actually different
        // Basic check for now, might need deep comparison if issues persist
        if (JSON.stringify(questions) !== JSON.stringify(initialQuestions)) {
            setQuestions(initialQuestions);

            // Reset expanded state if the currently expanded question is no longer present
            // or if the list became empty
            if (initialQuestions.length > 0 && !initialQuestions.some(q => q.id === expandedQuestionId)) {
                setExpandedQuestionId(initialQuestions[0].id);
            } else if (initialQuestions.length === 0) {
                setExpandedQuestionId(null);
            }
        }
    }, [initialQuestions]); // Only depend on initialQuestions

    // Helper function to update state and notify parent
    const updateAndNotify = useCallback((newQuestions: FormFieldConfig[]) => {
        setQuestions(newQuestions);
        onUpdateQuestions(newQuestions); // Notify parent immediately
    }, [onUpdateQuestions]);

    const addQuestion = (type: FormFieldType) => {
        const newQuestion = createFieldConfigFromFormFieldType(type);

        // For most field types, assign a descriptive temporary label if one isn't already assigned
        if (type !== 'contact-info' && type !== 'address') {
            // Assign a descriptive temporary label based on field type
            switch (type) {
                case 'short-text':
                    newQuestion.label = 'Short Text Question';
                    break;
                case 'long-text':
                    newQuestion.label = 'Long Text Question';
                    break;
                case 'date':
                    newQuestion.label = 'Date Question';
                    break;
                case 'dropdown':
                    newQuestion.label = 'Dropdown Question';
                    break;
                case 'multiple-choice':
                    newQuestion.label = 'Multiple Choice Question';
                    break;
                case 'yes-no':
                    newQuestion.label = 'Yes/No Question';
                    break;
                case 'required-checkbox':
                    newQuestion.label = 'I agree to the terms and conditions';
                    break;
                case 'file-upload':
                    newQuestion.label = 'Upload Files';
                    break;
                default:
                    newQuestion.label = `New ${fieldTypeLabels[type]} Question`;
            }
        } else {
            // For contact-info and address fields, use the type label
            // These will be displayed as type labels in the UI
            newQuestion.label = fieldTypeLabels[type];
        }

        const updated = [...questions, newQuestion];
        updateAndNotify(updated);
        setExpandedQuestionId(newQuestion.id);
    };

    const handleRemoveQuestion = (id: string) => {
        const updated = questions.filter(q => q.id !== id);
        updateAndNotify(updated);

        if (expandedQuestionId === id) {
            setExpandedQuestionId(null);
        }
    };

    // Update handlers for the FormFieldEditor
    const handleUpdateField = useCallback((id: string, updates: Partial<FormFieldConfig>) => {
        // This handler should NO LONGER handle type changes originating from FormFieldEditor's dropdown.
        // It only handles other updates like label changes, required toggles directly within FormFieldEditor (if any were added).

        // If updates includes 'type', it means this call originated from somewhere else (e.g. testing, programmatic change)
        // We might want to log a warning or handle it gracefully, but for now, we assume type changes only come via onFieldTypeChange.
        if (updates.type) {
            console.warn('handleUpdateField received a type update. This should be handled by onFieldTypeChange.');
            // Optionally, filter out the type update to prevent unexpected changes
            // delete updates.type;
            // Or simply return if we don't want to process such updates here
            // return;
        }

        // If no meaningful updates are left, return
        if (Object.keys(updates).length === 0 || (Object.keys(updates).length === 1 && updates.type)) {
            return;
        }

        const newQuestions = questions.map(q => {
            if (q.id === id) {
                // Just merge non-type updates
                const updatedField = { ...q, ...updates } as FormFieldConfig;
                return updatedField;
            }
            return q;
        });

        // Only update if something actually changed
        if (JSON.stringify(newQuestions) !== JSON.stringify(questions)) {
            updateAndNotify(newQuestions);
        }

        // Remove the onFieldTypeChange call from here
        // if (fieldTypeChanged && onFieldTypeChange && oldType && newType) {
        //     onFieldTypeChange(id, oldType, newType);
        // }
    }, [questions, updateAndNotify]); // Remove onFieldTypeChange from dependencies

    const handleToggleOptions = (id: string) => {
        if (expandedQuestionId === id) {
            setExpandedQuestionId(null);
        } else {
            setExpandedQuestionId(id);
        }
    };

    // Handle drag start
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id.toString());

        // Find the question being dragged
        const draggedQuestion = questions.find(q => q.id === active.id);
        if (draggedQuestion) {
            setActiveQuestion(draggedQuestion);

            // Save current expanded state if the dragged question is the expanded one
            if (expandedQuestionId === active.id.toString()) {
                setPreviousExpandedId(expandedQuestionId);
                setExpandedQuestionId(null); // Collapse during drag
            }
        }
    };

    // Handle drag end event
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        // Restore expanded state if this question was expanded before drag
        if (previousExpandedId === active.id.toString()) {
            setExpandedQuestionId(previousExpandedId);
            setPreviousExpandedId(null);
        }

        setActiveId(null);
        setActiveQuestion(null);

        if (over && active.id !== over.id) {
            const oldIndex = questions.findIndex((q) => q.id === active.id);
            const newIndex = questions.findIndex((q) => q.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const updated = arrayMove(questions, oldIndex, newIndex);
                updateAndNotify(updated);
            }
        }
    }, [questions, updateAndNotify, previousExpandedId]);

    // Check which question types are already used (for unique question types)
    const usedTypes = questions.map(q => q.type as FormFieldType);
    const baseQuestionTypes = baseQuestions.map(q => q.type as FormFieldType);

    // Create an array of all question types, EXCLUDING contact-info
    const allQuestionTypes = (Object.keys(fieldTypeLabels) as FormFieldType[])
        .filter(type => type !== 'contact-info');

    // Check if a question type should be disabled for ADDING
    const isTypeDisabled = (type: FormFieldType) => {
        // Disable if it's a unique type AND exists in either current list OR base list
        return uniqueFieldTypes.includes(type) &&
            (usedTypes.includes(type) || baseQuestionTypes.includes(type));
    };

    return (
        <div className="space-y-4">
            {questions.length > 0 ? (
                <div className="relative" style={{ zIndex: activeId ? 10 : 'auto' }}>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={questions.map(q => q.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-4">
                                {questions.map(field => {
                                    // Get all other field types in use for unique field checking IN THIS LIST
                                    const otherUsedTypes = usedTypes.filter(t => t !== field.type);

                                    return (
                                        <SortableField
                                            key={field.id}
                                            id={field.id}
                                            config={field}
                                            baseQuestions={baseQuestions}
                                            handlers={{
                                                onRemove: handleRemoveQuestion,
                                                onUpdateField: handleUpdateField,
                                                onToggleOptions: handleToggleOptions,
                                                onOptionValueChange,
                                                onFieldTypeChange
                                            }}
                                            uiState={{
                                                showOptions: field.id === expandedQuestionId,
                                                // Pass only types used in THIS list (excluding current field)
                                                // FormFieldEditor will combine this with baseQuestions
                                                usedFieldTypes: otherUsedTypes
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </SortableContext>

                        {/* Use a portal to render the drag overlay outside the DOM hierarchy */}
                        {createPortal(
                            <DragOverlay adjustScale={false} zIndex={1000}>
                                {activeId && activeQuestion && (
                                    <div className="opacity-20 w-full bg-background rounded-lg shadow-lg">
                                        <FormFieldEditor
                                            config={activeQuestion}
                                            showOptions={false}
                                            onRemove={() => { }}
                                            onUpdateField={() => { }}
                                            isBeingDragged={true}
                                        />
                                    </div>
                                )}
                            </DragOverlay>,
                            document.body
                        )}
                    </DndContext>
                </div>
            ) : (
                <div className="text-center py-8 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground">No questions added yet</p>
                </div>
            )}

            <div className="flex justify-center">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="w-full justify-center"
                            size="lg"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Add question
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-56">
                        <TooltipProvider>
                            {allQuestionTypes.map(type => {
                                const disabled = isTypeDisabled(type);
                                const IconComponent = fieldTypeIcons[type];
                                const label = fieldTypeLabels[type];

                                return disabled ? (
                                    <Tooltip key={type}>
                                        <TooltipTrigger asChild>
                                            <div className="w-full">
                                                <DropdownMenuItem
                                                    disabled
                                                    className="opacity-60 cursor-not-allowed"
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center">
                                                            {IconComponent}
                                                            <span className="ml-2">{label}</span>
                                                        </div>
                                                    </div>
                                                </DropdownMenuItem>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Already used in this form</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <DropdownMenuItem
                                        key={type}
                                        onClick={() => addQuestion(type)}
                                    >
                                        <div className="flex items-center">
                                            {IconComponent}
                                            <span className="ml-2">{label}</span>
                                        </div>
                                    </DropdownMenuItem>
                                );
                            })}
                        </TooltipProvider>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};