import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MinusIcon,
    PlusIcon,
    TextIcon,
    MapPinnedIcon,
    BookUserIcon,
    FileIcon,
    CalendarIcon,
    ListIcon,
    FileTextIcon,
    CheckSquareIcon,
    ToggleLeftIcon,
    MoreVerticalIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    Trash2Icon,
    GripVerticalIcon,
    ListChecksIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
    FormFieldConfig,
    SimpleFieldConfig,
    ChoiceFieldConfig,
    ContactInfoFieldConfig,
    AddressFieldConfig,
    isFieldRequired,
    FormFieldType
} from "@/features/booking/lib/form-field-types";

// Input max length constants
const MAX_LENGTH = {
    FIELD_LABEL: 100,
    DROPDOWN_OPTION: 100,
    CHECKBOX_OPTION: 100
};

// Types that can only be added once
export const uniqueFieldTypes: FormFieldType[] = [
    "contact-info",
    "address"
];

export interface FormFieldEditorProps {
    config: FormFieldConfig;
    showOptions?: boolean;
    onToggleOptions?: () => void;
    onRemove: (id: string) => void;
    onUpdateField: (id: string, updates: Partial<FormFieldConfig>) => void;
    usedFieldTypes?: FormFieldType[];
    isBeingDragged?: boolean;
    showDragIcon?: boolean;
    dragHandleProps?: {
        attributes?: Record<string, any>;
        listeners?: Record<string, any>;
    };
    onOptionValueChange?: (fieldId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) => void;
    onFieldTypeChange?: (fieldId: string, oldType: FormFieldType, newType: FormFieldType) => void;
    formValues?: Record<string, any>;
    baseQuestions?: FormFieldConfig[];
}

export const fieldTypeIcons: Record<FormFieldType, React.ReactNode> = {
    "contact-info": <BookUserIcon className="h-4 w-4" />,
    "address": <MapPinnedIcon className="h-4 w-4" />,
    "short-text": <TextIcon className="h-4 w-4" />,
    "long-text": <FileTextIcon className="h-4 w-4" />,
    "date": <CalendarIcon className="h-4 w-4" />,
    "file-upload": <FileIcon className="h-4 w-4" />,
    "dropdown": <ListIcon className="h-4 w-4" />,
    "yes-no": <ToggleLeftIcon className="h-4 w-4" />,
    "multiple-choice": <ListChecksIcon className="h-4 w-4" />,
    "required-checkbox": <CheckSquareIcon className="h-4 w-4" />
};

export const fieldTypeLabels: Record<FormFieldType, string> = {
    "contact-info": "Contact Info",
    "address": "Address",
    "short-text": "Short Text",
    "long-text": "Long Text",
    "date": "Date",
    "file-upload": "File Upload",
    "yes-no": "Yes/No",
    "dropdown": "Dropdown",
    "multiple-choice": "Multiple Choice",
    "required-checkbox": "Required Checkbox"
};

export function FormFieldEditor({
    config,
    showOptions = true,
    onToggleOptions,
    onRemove,
    onUpdateField,
    usedFieldTypes = [],
    isBeingDragged,
    showDragIcon,
    dragHandleProps,
    onOptionValueChange,
    onFieldTypeChange,
    baseQuestions = []
}: FormFieldEditorProps): React.ReactNode {
    const [isHovered, setIsHovered] = useState(false);
    const { id, type, label } = config;

    // Use the type directly as FormFieldType
    const fieldType = type as FormFieldType;

    // Calculate base question types once
    const baseQuestionTypes = baseQuestions.map(q => q.type as FormFieldType);

    const toggleOptions = (e?: React.MouseEvent) => {
        // If event is provided, stop propagation to prevent it from triggering drag
        if (e) {
            e.stopPropagation();
        }

        if (onToggleOptions) {
            onToggleOptions();
        }
    };

    const updateFieldLabel = (value: string) => {
        onUpdateField(id, { label: value });
    };

    // Check if a field type should be disabled for CHANGING type
    const isTypeDisabled = (targetType: FormFieldType) => {
        // Disable if it's a unique type AND exists elsewhere in the current list (usedFieldTypes)
        // OR if it exists in the base questions list
        return (
            uniqueFieldTypes.includes(targetType) &&
            (usedFieldTypes.includes(targetType) || baseQuestionTypes.includes(targetType))
        );
    };

    const renderFieldTypeSelect = () => (
        <div
            className="flex justify-between items-center w-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-center flex-grow overflow-hidden">
                {isHovered && showDragIcon ? (
                    <div
                        className="text-muted-foreground cursor-grab flex-shrink-0"
                        {...(dragHandleProps ? { ...dragHandleProps.attributes, ...dragHandleProps.listeners } : {})}
                    >
                        <GripVerticalIcon className="h-4 w-4" />
                    </div>
                ) : (
                    <div className="min-w-4 flex-shrink-0">
                        {fieldTypeIcons[fieldType]}
                    </div>
                )}
                <span className="ml-2 font-medium truncate inline-block">
                    {fieldType === 'contact-info' || fieldType === 'address' ?
                        fieldTypeLabels[fieldType] :
                        label ?
                            label :
                            <span className="text-muted-foreground">{fieldTypeLabels[fieldType]}</span>
                    }
                </span>
            </div>

            <div className="flex items-center space-x-2">
                {type !== "contact-info" && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 w-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100 hover:opacity-100 group-hover:w-9 group-focus:w-9 focus:w-9 hover:w-9 transition-none"
                                onClick={(e) => e.stopPropagation()} // Stop propagation here to prevent drag
                            >
                                <MoreVerticalIcon className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>
                                <p className="text-muted-foreground">Change to...</p>
                            </DropdownMenuLabel>
                            <TooltipProvider>
                                {Object.entries(fieldTypeLabels)
                                    .filter(([value]) => value !== 'contact-info') // Exclude contact-info
                                    .map(([value, label]) => {
                                        const targetFieldType = value as FormFieldType;
                                        const disabled = isTypeDisabled(targetFieldType);

                                        return disabled ? (
                                            <Tooltip key={value}>
                                                <TooltipTrigger asChild>
                                                    <div>
                                                        <DropdownMenuItem
                                                            disabled
                                                            className="opacity-60 cursor-not-allowed"
                                                        >
                                                            <div className="flex items-center">
                                                                {fieldTypeIcons[targetFieldType]}
                                                                <span className="ml-2">{label}</span>
                                                            </div>
                                                        </DropdownMenuItem>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Already used in this form</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : type !== targetFieldType ? (
                                            <DropdownMenuItem
                                                key={value}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const currentType = type as FormFieldType;
                                                    if (onFieldTypeChange) {
                                                        onFieldTypeChange(id, currentType, targetFieldType);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center">
                                                    {fieldTypeIcons[targetFieldType]}
                                                    <span className="ml-2">{label}</span>
                                                </div>
                                            </DropdownMenuItem>
                                        ) : null;
                                    })}
                            </TooltipProvider>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onRemove(id)}>
                                <Trash2Icon className="h-4 w-4" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => toggleOptions(e)}
                >
                    {showOptions ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );

    const renderFieldContent = () => {
        if (!showOptions) return null;

        switch (type) {
            case "address":
                return renderAddress();
            case "short-text":
            case "long-text":
                return renderTextField();
            case "date":
                return renderSimpleField("Date");
            case "file-upload":
                return renderFileUpload();
            case "dropdown":
                return renderDropdown();
            case "yes-no":
                return renderYesNo();
            case "multiple-choice":
                return renderMultipleChoice();
            case "required-checkbox":
                return renderRequiredCheckbox();
            case "contact-info":
                return renderContactInfo();
            default:
                return null;
        }
    };

    const renderFooter = () => {
        // Don't render footer for contact-info (already handled)
        if (type === "contact-info") return null;

        // For yes-no and required-checkbox, only show delete button, not required toggle
        if (type === "yes-no" || type === "required-checkbox") {
            return (
                <div className="flex items-center justify-between w-full border-t pt-3 mt-3">
                    <div className="flex-1"></div> {/* Empty space where the required toggle would be */}
                    <Button variant="ghost" size="icon" onClick={() => onRemove(id)}>
                        <Trash2Icon className="h-4 w-4" />
                    </Button>
                </div>
            );
        }

        return (
            <div className="flex items-center justify-between w-full border-t pt-3 mt-3">
                <div className="flex items-center space-x-2">
                    <Switch
                        id={`required-${id}`}
                        checked={isFieldRequired(config)}
                        onCheckedChange={(checked) => {
                            // Generic handler for simple fields
                            if (type === 'short-text' || type === 'long-text' || type === 'date' || type === 'file-upload') {
                                onUpdateField(id, {
                                    ...(config as SimpleFieldConfig),
                                    isRequired: checked
                                });
                            }
                            // For choice fields, handle depending on the type
                            else if (type === 'dropdown' || type === 'multiple-choice') {
                                onUpdateField(id, {
                                    ...(config as ChoiceFieldConfig),
                                    isRequired: checked
                                });
                            }
                            // Handle address fields with a single required toggle
                            else if (type === 'address') {
                                const addressConfig = config as AddressFieldConfig;
                                onUpdateField(id, {
                                    fieldConfig: {
                                        ...addressConfig.fieldConfig,
                                        streetRequired: checked,
                                        street2Required: false, // Always optional
                                        cityRequired: checked,
                                        stateRequired: checked,
                                        zipRequired: checked
                                    }
                                });
                            }
                            // Other complex types have their own required handling
                        }}
                    />
                    <label htmlFor={`required-${id}`} className="text-sm">Required</label>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemove(id)}>
                    <Trash2Icon className="h-4 w-4" />
                </Button>
            </div>
        );
    };

    const renderContactInfo = () => {
        if (type !== 'contact-info') return null;

        const contactConfig = config as ContactInfoFieldConfig;
        const settings = contactConfig.fieldConfig || {
            emailRequired: false,
            phoneRequired: false,
            companyRequired: false
        };

        const handleEmailToggle = (checked: boolean) => {
            onUpdateField(id, {
                fieldConfig: {
                    ...settings,
                    emailRequired: checked
                }
            } as Partial<FormFieldConfig>);
        };

        const handlePhoneToggle = (checked: boolean) => {
            onUpdateField(id, {
                fieldConfig: {
                    ...settings,
                    phoneRequired: checked
                }
            } as Partial<FormFieldConfig>);
        };

        const handleCompanyToggle = (checked: boolean) => {
            onUpdateField(id, {
                fieldConfig: {
                    ...settings,
                    companyRequired: checked
                }
            } as Partial<FormFieldConfig>);
        };

        return (
            <div className="space-y-3 mt-3 border-t pt-4">
                <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center space-x-2">
                        <Switch
                            id={`email-required-${id}`}
                            checked={settings.emailRequired}
                            onCheckedChange={handleEmailToggle}
                        />
                        <label htmlFor={`email-required-${id}`} className="text-sm">Email required</label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id={`phone-required-${id}`}
                            checked={settings.phoneRequired}
                            onCheckedChange={handlePhoneToggle}
                        />
                        <label htmlFor={`phone-required-${id}`} className="text-sm">Phone required</label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id={`company-required-${id}`}
                            checked={settings.companyRequired}
                            onCheckedChange={handleCompanyToggle}
                        />
                        <label htmlFor={`company-required-${id}`} className="text-sm">Company required</label>
                    </div>
                </div>
            </div>
        );
    };

    const renderAddress = () => {
        if (type !== 'address') return null;

        // Modify the label field to provide context for the address field
        return (
            <div className="space-y-3 mt-3">
                {renderFooter()}
            </div>
        );
    };

    const renderTextField = () => (
        <div className="space-y-3 mt-3">
            <div className="flex space-x-2 items-center w-full">
                <Input
                    placeholder={`Enter ${type === "short-text" ? "question" : "long text question"}`}
                    value={label || ""}
                    onChange={(e) => updateFieldLabel(e.target.value)}
                    className="w-full bg-background"
                    maxLength={MAX_LENGTH.FIELD_LABEL}
                />
            </div>
            {renderFooter()}
        </div>
    );

    const renderSimpleField = (fieldLabel: string) => (
        <div className="space-y-3 mt-3">
            <div className="flex space-x-2 items-center w-full">
                <Input
                    placeholder={`Enter ${fieldLabel} label`}
                    value={label || ""}
                    onChange={(e) => updateFieldLabel(e.target.value)}
                    className="w-full bg-background"
                    maxLength={MAX_LENGTH.FIELD_LABEL}
                />
            </div>
            {renderFooter()}
        </div>
    );

    const renderFileUpload = () => (
        <div className="space-y-3 mt-3">
            <div className="flex space-x-2 items-center w-full">
                <Input
                    placeholder="Enter file upload label"
                    value={label || ""}
                    onChange={(e) => updateFieldLabel(e.target.value)}
                    className="w-full bg-background"
                    maxLength={MAX_LENGTH.FIELD_LABEL}
                />
            </div>
            {renderFooter()}
        </div>
    );

    const renderDropdown = () => {
        if (type !== 'dropdown') return null;

        const dropdownConfig = config as ChoiceFieldConfig;
        const options = dropdownConfig.options || [];

        // Track duplicate option values
        const valueCount = new Map<string, number>();
        options.forEach(option => {
            const count = valueCount.get(option.value) || 0;
            valueCount.set(option.value, count + 1);
        });

        const handleOptionChange = (index: number, value: string) => {
            const newOptions = [...options];
            const oldValue = newOptions[index].value;
            newOptions[index] = { ...newOptions[index], value, label: value };

            // Call onOptionValueChange where needed
            if (onOptionValueChange && oldValue !== value) {
                onOptionValueChange(id, 'option-change', oldValue, value);
            }

            onUpdateField(id, { options: newOptions } as Partial<FormFieldConfig>);
        };

        const handleRemoveOption = (index: number) => {
            const removedOption = options[index];
            const newOptions = options.filter((_, i) => i !== index);

            // Call onOptionValueChange to signal option removal (empty newValue)
            if (onOptionValueChange) {
                onOptionValueChange(id, 'option-change', removedOption.value, '');
            }

            onUpdateField(id, { options: newOptions } as Partial<FormFieldConfig>);
        };

        const handleAddOption = () => {
            const optionNumber = options.length + 1;
            const newOption = { value: `Option ${optionNumber}`, label: `Option ${optionNumber}` };
            onUpdateField(id, { options: [...options, newOption] } as Partial<FormFieldConfig>);
        };

        return (
            <div className="space-y-3 mt-3">
                <div className="flex space-x-2 items-center w-full">
                    <Input
                        placeholder="Enter dropdown question"
                        value={label || ""}
                        onChange={(e) => updateFieldLabel(e.target.value)}
                        className="w-full bg-background"
                        maxLength={MAX_LENGTH.FIELD_LABEL}
                    />
                </div>

                <div className="space-y-1 border-t pt-3">
                    {options.map((option, i) => {
                        const isDuplicate = (valueCount.get(option.value) ?? 0) > 1;

                        return (
                            <div key={`option-${i}`} className="flex items-center space-x-2">
                                <Input
                                    placeholder={`Option ${i + 1}`}
                                    value={option.value}
                                    onChange={(e) => handleOptionChange(i, e.target.value)}
                                    className={cn("w-full bg-background")}
                                    aria-invalid={isDuplicate}
                                    maxLength={MAX_LENGTH.DROPDOWN_OPTION}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={options.length <= 2}
                                    onClick={() => handleRemoveOption(i)}
                                >
                                    <MinusIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        );
                    })}

                    <Button
                        variant="link"
                        onClick={handleAddOption}
                    >
                        <PlusIcon className="h-4 w-4" />
                        Add option
                    </Button>
                </div>

                {renderFooter()}
            </div>
        );
    };

    const renderYesNo = () => (
        <div className="space-y-3 mt-3">
            <div className="flex space-x-2 items-center w-full">
                <Input
                    placeholder="Enter Yes/No question"
                    value={label || ""}
                    onChange={(e) => updateFieldLabel(e.target.value)}
                    className="w-full bg-background"
                    maxLength={MAX_LENGTH.FIELD_LABEL}
                />
            </div>
            {renderFooter()}
        </div>
    );

    const renderMultipleChoice = () => {
        if (type !== 'multiple-choice') return null;

        const multipleChoiceConfig = config as ChoiceFieldConfig;
        const options = multipleChoiceConfig.options || [];

        // Track duplicate option values
        const valueCount = new Map<string, number>();
        options.forEach(option => {
            const count = valueCount.get(option.value) || 0;
            valueCount.set(option.value, count + 1);
        });

        const handleOptionChange = (index: number, value: string) => {
            const newOptions = [...options];
            const oldValue = newOptions[index].value;
            newOptions[index] = { ...newOptions[index], value, label: value };

            // Call onOptionValueChange where needed
            if (onOptionValueChange && oldValue !== value) {
                onOptionValueChange(id, 'option-change', oldValue, value);
            }

            onUpdateField(id, { options: newOptions } as Partial<FormFieldConfig>);
        };

        const handleRemoveOption = (index: number) => {
            const removedOption = options[index];
            const newOptions = options.filter((_, i) => i !== index);

            // Call onOptionValueChange to signal option removal (empty newValue)
            if (onOptionValueChange) {
                onOptionValueChange(id, 'option-change', removedOption.value, '');
            }

            onUpdateField(id, { options: newOptions } as Partial<FormFieldConfig>);
        };

        const handleAddOption = () => {
            const optionNumber = options.length + 1;
            const newOption = { value: `Option ${optionNumber}`, label: `Option ${optionNumber}` };
            onUpdateField(id, { options: [...options, newOption] } as Partial<FormFieldConfig>);
        };

        return (
            <div className="space-y-3 mt-3">
                <div className="flex space-x-2 items-center w-full">
                    <Input
                        placeholder="Enter multiple choice question"
                        value={label || ""}
                        onChange={(e) => updateFieldLabel(e.target.value)}
                        className="w-full bg-background"
                        maxLength={MAX_LENGTH.FIELD_LABEL}
                    />
                </div>

                <div className="space-y-1 border-t pt-3">
                    {options.map((option, i) => {
                        const isDuplicate = (valueCount.get(option.value) ?? 0) > 1;

                        return (
                            <div key={`option-${i}`} className="flex items-center space-x-2">
                                <Input
                                    placeholder={`Option ${i + 1}`}
                                    value={option.value}
                                    onChange={(e) => handleOptionChange(i, e.target.value)}
                                    className={cn("w-full bg-background")}
                                    aria-invalid={isDuplicate}
                                    maxLength={MAX_LENGTH.CHECKBOX_OPTION}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={options.length <= 2}
                                    onClick={() => handleRemoveOption(i)}
                                >
                                    <MinusIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        );
                    })}

                    <Button
                        variant="link"
                        onClick={handleAddOption}
                    >
                        <PlusIcon className="h-4 w-4" />
                        Add option
                    </Button>
                </div>

                {renderFooter()}
            </div>
        );
    };

    const renderRequiredCheckbox = () => (
        <div className="space-y-3 mt-3">
            <div className="flex space-x-2 items-center w-full">
                <Input
                    placeholder="Enter checkbox label (e.g., I agree to terms and conditions)"
                    value={label || ""}
                    onChange={(e) => updateFieldLabel(e.target.value)}
                    className="w-full bg-background"
                    maxLength={MAX_LENGTH.FIELD_LABEL}
                />
            </div>
            {renderFooter()}
        </div>
    );

    return (
        <div
            className={cn(
                "bg-background group",
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={cn(
                "bg-muted/50 p-5 rounded-lg",
                isBeingDragged && "opacity-75 border border-dashed border-primary/50"
            )}>
                <div className="flex items-center">
                    {renderFieldTypeSelect()}
                </div>

                {
                    <div className="space-y-1">
                        <AnimatePresence>
                            {showOptions && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {renderFieldContent()}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                }
            </div>
        </div>
    );
}