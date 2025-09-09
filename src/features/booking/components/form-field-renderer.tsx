import React, { useCallback } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Checkbox } from "@/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Button } from "@/ui/button";
import { Calendar } from "@/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Switch } from "@/ui/switch";
import {
    FormFieldConfig,
    ChoiceFieldConfig,
    ContactInfoFieldConfig,
    AddressFieldConfig,
    isFieldRequired,
    isSubfieldRequired,
    BaseFieldConfig,
    ChoiceOption
} from "@/features/booking/lib/form-field-types";
import { getFieldValidation, shouldShowFieldError } from "@/features/booking/lib/form-validation";
import { Control } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, CloudUpload, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

// Input max length constants
const MAX_LENGTH = {
    SHORT_TEXT: 255,
    LONG_TEXT: 1000,
    FIRST_NAME: 50,
    LAST_NAME: 50,
    EMAIL: 100,
    PHONE: 20,
    COMPANY: 100,
    STREET: 100,
    STREET2: 100,
    CITY: 50,
    STATE: 30,
    ZIP: 15
};

interface FormFieldRendererProps {
    field: FormFieldConfig;
    control: Control<any>;
    onFileUpdate?: (fieldName: string, newFiles: File[], oldFiles?: File[]) => boolean;
    maxTotalFileSize?: number;
    currentTotalFileSize?: number;
    showValidation?: boolean;
    onOptionValueChange?: (questionId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) => void;
    darkMode?: boolean;
}

// Type guard for choice fields
const isChoiceField = (field: FormFieldConfig): field is ChoiceFieldConfig => {
    return field.type === 'dropdown' || field.type === 'multiple-choice';
}

export const FormFieldRenderer: React.FC<FormFieldRendererProps> = ({
    field,
    control,
    onFileUpdate,
    maxTotalFileSize,
    showValidation = false,
    onOptionValueChange,
    darkMode = false
}) => {
    // To detect field type changes, use a ref to store the current field type
    const previousFieldTypeRef = React.useRef<string | null>(null);

    // Global effect to sanitize any value when the field type changes
    React.useEffect(() => {
        // Skip on first render
        if (previousFieldTypeRef.current === null) {
            previousFieldTypeRef.current = field.type;
            return;
        }

        // If field type changed, log and potentially reset the value
        if (previousFieldTypeRef.current !== field.type) {
            previousFieldTypeRef.current = field.type;
        }
    }, [field.type, field.id]);

    // Determine if a field is required using the isFieldRequired helper
    const checkRequired = (field: FormFieldConfig, subfieldId?: string): boolean => {
        if (subfieldId) {
            return isSubfieldRequired(field, subfieldId);
        }
        return isFieldRequired(field);
    };

    // Helper to render field label with missing label indicator
    const renderFieldLabel = (label?: string) => {
        return label ?
            <>{label}</> :
            <span className="text-muted-foreground">Missing label</span>;
    };

    // Helper to determine if we should show validation errors
    const shouldShowError = (fieldValue: any, isRequired: boolean) => {
        return shouldShowFieldError(fieldValue, isRequired, showValidation);
    };

    // Get placeholder based on field type
    const getFieldPlaceholder = (field: FormFieldConfig, subfieldName?: string): string => {
        // For nested fields like contact-info and address, use specific placeholders based on subfield
        if (subfieldName) {
            const nameParts = subfieldName.split('.');
            const lastPart = nameParts[nameParts.length - 1];

            // Contact info subfields
            if (field.type === 'contact-info') {
                switch (lastPart) {
                    case 'firstName': return 'First Name';
                    case 'lastName': return 'Last Name';
                    case 'email': return 'Email';
                    case 'phone': return 'Phone';
                    case 'company': return 'Company';
                }
            }

            // Address subfields
            if (field.type === 'address') {
                switch (lastPart) {
                    case 'street': return 'Street Address';
                    case 'street2': return 'Apartment, suite, etc.';
                    case 'city': return 'City';
                    case 'state': return 'State';
                    case 'zip': return 'ZIP Code';
                }
            }
        }

        // For top-level fields, use type-based placeholders
        switch (field.type) {
            case 'contact-info':
                return 'Contact Information';
            case 'address':
                return 'Address';
            case 'short-text':
                return 'Enter text';
            case 'long-text':
                return 'Enter details';
            case 'date':
                return 'Select date';
            case 'dropdown':
                return `Select an option`;
            case 'file-upload':
                return 'Select file to upload';
            case 'yes-no':
            case 'required-checkbox':
            case 'multiple-choice':
                return '';
            default:
                return '';
        }
    };

    // Format file size for display
    const formatFileSize = (sizeBytes: number) => {
        if (sizeBytes < 1024) return `${sizeBytes} bytes`;
        else if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
        else if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    // Render different form fields based on the field type
    switch (field.type) {
        case "short-text":
            return (
                <FormField
                    key={field.id}
                    control={control}
                    name={field.name}
                    rules={getFieldValidation(field)}
                    render={({ field: formField, fieldState }) => {
                        const isInvalid = shouldShowError(formField.value, checkRequired(field));
                        const errorMessage = fieldState.error?.message;

                        return (
                            <FormItem className="space-y-.5">
                                <FormLabel>{renderFieldLabel(field.label)}{checkRequired(field) ? ' *' : ''}</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder={getFieldPlaceholder(field)}
                                        {...formField}
                                        value={formField.value ?? ""}
                                        aria-required={checkRequired(field)}
                                        aria-invalid={isInvalid}
                                        className={isInvalid ? "border-destructive" : ""}
                                        maxLength={MAX_LENGTH.SHORT_TEXT}
                                    />
                                </FormControl>
                                {isInvalid && errorMessage && (
                                    <FormMessage className="text-destructive text-sm font-medium">
                                        {errorMessage}
                                    </FormMessage>
                                )}
                            </FormItem>
                        );
                    }}
                />
            );

        case "long-text":
            return (
                <FormField
                    key={`${field.id}-${field.type}`}
                    control={control}
                    name={field.name}
                    rules={getFieldValidation(field)}
                    render={({ field: formField, fieldState }) => {
                        const isInvalid = shouldShowError(formField.value, checkRequired(field));
                        const errorMessage = fieldState.error?.message;

                        return (
                            <FormItem className="space-y-.5">
                                <FormLabel>{renderFieldLabel(field.label)}{checkRequired(field) ? ' *' : ''}</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder={getFieldPlaceholder(field)}
                                        {...formField}
                                        value={formField.value ?? ""}
                                        aria-required={checkRequired(field)}
                                        aria-invalid={isInvalid}
                                        className={isInvalid ? "border-destructive" : ""}
                                        maxLength={MAX_LENGTH.LONG_TEXT}
                                    />
                                </FormControl>
                                {isInvalid && errorMessage && (
                                    <FormMessage className="text-destructive text-sm font-medium">
                                        {errorMessage}
                                    </FormMessage>
                                )}
                            </FormItem>
                        );
                    }}
                />
            );

        case "date":
            return (
                <FormField
                    key={`${field.id}-${field.type}`}
                    control={control}
                    name={field.name}
                    rules={getFieldValidation(field)}
                    render={({ field: formField }) => {
                        const [open, setOpen] = React.useState(false);
                        const isInvalid = shouldShowError(formField.value, checkRequired(field));

                        // Safely handle potentially invalid date values
                        const safelyFormatDate = (dateValue: any) => {
                            try {
                                if (!dateValue) return null;
                                const date = new Date(dateValue);
                                // Check if date is valid
                                if (isNaN(date.getTime())) {
                                    return null;
                                }
                                return format(date, "PPP");
                            } catch (err) {
                                return null;
                            }
                        };

                        const formattedDate = safelyFormatDate(formField.value);

                        return (
                            <FormItem className="flex flex-col space-y-.5">
                                <FormLabel>{renderFieldLabel(field.label)}{checkRequired(field) ? ' *' : ''}</FormLabel>
                                <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal justify-start",
                                                    !formField.value && "text-muted-foreground"
                                                )}
                                                type="button"
                                                aria-haspopup="dialog"
                                                aria-expanded={open}
                                                aria-required={checkRequired(field)}
                                                aria-invalid={isInvalid}
                                            >
                                                <CalendarIcon className="h-4 w-4" />
                                                <span className="ml-2">
                                                    {formattedDate ? formattedDate : getFieldPlaceholder(field)}
                                                </span>
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className={cn("w-auto p-0", darkMode && "dark")} align="start">
                                        <Calendar
                                            mode="single"
                                            selected={formField.value ? new Date(formField.value) : undefined}
                                            onSelect={(date) => {
                                                formField.onChange(date ? date.toISOString() : "");
                                                setOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />
            );

        case "file-upload":
            return (
                <FormField
                    key={field.id}
                    control={control}
                    name={field.name}
                    rules={getFieldValidation(field)}
                    render={({ field: formField }) => {
                        const onDrop = useCallback((acceptedFiles: File[]) => {
                            // Get previous files for size calculation
                            const previousFiles = formField.value || [];

                            // Create new files array
                            const allFiles = [...previousFiles, ...acceptedFiles];

                            // Check the total size across all uploads if we have the callback
                            if (onFileUpdate && maxTotalFileSize) {
                                const willAcceptFiles = onFileUpdate(field.name, allFiles, previousFiles);
                                if (!willAcceptFiles) {
                                    toast.error("Total file size exceeded", {
                                        description: `Your total uploads would exceed the maximum limit of ${formatFileSize(maxTotalFileSize)}. Please remove some files first.`,
                                    });
                                    return;
                                }
                            }

                            // Store the files in form state
                            formField.onChange(allFiles);
                        }, [formField, onFileUpdate, field.name, maxTotalFileSize]);

                        const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
                            onDrop,
                            multiple: true // Allow multiple files
                        });

                        // Handle file removal for a specific file
                        const handleRemoveFile = (index: number) => {
                            const previousFiles = formField.value || [];

                            // Don't attempt removal if the index doesn't exist
                            if (index < 0 || index >= previousFiles.length) return;

                            // Create a copy of files array with the selected file removed
                            const newFiles = [...previousFiles];
                            const removedFile = newFiles.splice(index, 1)[0];

                            // Update total size through callback
                            if (onFileUpdate) {
                                onFileUpdate(field.name, newFiles, [removedFile]);
                            }

                            // Update the field
                            formField.onChange(newFiles);
                        };

                        // Display the selected files
                        const files = formField.value || [];
                        const hasFiles = files.length > 0;
                        const isInvalid = shouldShowError(files, checkRequired(field));

                        return (
                            <FormItem className="space-y-1">
                                <FormLabel>{renderFieldLabel(field.label)}{checkRequired(field) ? ' *' : ''}</FormLabel>
                                <FormControl>
                                    <div className="space-y-4">
                                        <div
                                            {...getRootProps()}
                                            className={cn(
                                                "h-48 border-2 border-dashed rounded-md p-6 cursor-pointer transition-colors",
                                                isDragActive ? "border-primary bg-primary/5" : "border-input",
                                                isInvalid ? "border-destructive" : "",
                                                "flex flex-col items-center justify-center gap-2"
                                            )}
                                        >
                                            <input
                                                {...getInputProps()}
                                                aria-required={checkRequired(field)}
                                                aria-invalid={isInvalid}
                                            />
                                            {isDragActive ? (
                                                <>
                                                    <CloudUpload className="size-10" strokeWidth={1.5} />
                                                    <p className="text-center text-sm">Drop the files here ...</p>
                                                </>
                                            ) : (
                                                <>
                                                    <CloudUpload className="size-10 text-muted-foreground" strokeWidth={1.5} />
                                                    <div className="text-center">
                                                        <p className="text-sm font-medium">Drag & drop your files here</p>
                                                        <p className="text-xs text-muted-foreground mt-2">Or</p>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            open();
                                                        }}
                                                    >
                                                        Browse Files
                                                    </Button>
                                                </>
                                            )}
                                        </div>

                                        {hasFiles && (
                                            <div className="space-y-2 mt-2">
                                                <ul className="space-y-.5">
                                                    {files.map((file: File, index: number) => (
                                                        <li key={`${file.name}-${index}`} className="flex items-center">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-6 text-muted-foreground"
                                                                onClick={() => handleRemoveFile(index)}
                                                            >
                                                                <span className="sr-only">Remove</span>
                                                                <X className="size-4" />
                                                            </Button>
                                                            <span className="ml-2 truncate text-sm">{file.name}</span>
                                                            <span className="ml-2 text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />
            );

        case "dropdown":
            return (
                <FormField
                    key={`${field.id}-${field.type}`}
                    control={control}
                    name={field.name}
                    rules={getFieldValidation(field)}
                    render={({ field: formField, fieldState }) => {
                        const options = isChoiceField(field) ? field.options : [];
                        const hasValue = typeof formField.value === "string" && formField.value !== "";
                        const valueExists = hasValue && options.some(o => o.value === formField.value);
                        const isInvalid = fieldState.invalid || shouldShowError(formField.value, checkRequired(field));
                        const errorMessage = fieldState.error?.message;

                        // Reference to track the original onChange function
                        const originalOnChangeRef = React.useRef(formField.onChange);

                        // Replace the onChange with our monitored version if it changed
                        React.useEffect(() => {
                            if (formField.onChange !== originalOnChangeRef.current) {
                                const originalOnChange = formField.onChange;
                                originalOnChangeRef.current = originalOnChange;

                                // Replace with monitored version
                                formField.onChange = (...args: any[]) => {
                                    return originalOnChange(...args);
                                };
                            }
                        }, [formField.onChange, field.id]);

                        // Add more detailed logging for value changes
                        const prevValueRef = React.useRef(formField.value);
                        React.useEffect(() => {
                            if (prevValueRef.current && prevValueRef.current !== "" && formField.value === "") {
                                // Value reset detected
                            } else if (prevValueRef.current !== formField.value) {
                                // If onOptionValueChange is provided, notify it of value updates
                                if (onOptionValueChange && prevValueRef.current !== formField.value) {
                                    onOptionValueChange(field.id, 'value-update', prevValueRef.current || "", formField.value || "");
                                }
                            }
                            prevValueRef.current = formField.value;
                        }, [formField.value, field.id, field.name, options, formField, fieldState, onOptionValueChange]);

                        // Log if value doesn't exist in options (but don't try to handle it)
                        if (hasValue && !valueExists) {
                            // Value not found in options - FormFieldRenderer will display what it's given
                        }

                        // Create a controlled component with stable onChange handler
                        const handleChange = React.useCallback((value: string) => {
                            formField.onChange(value);
                        }, [formField, field.id]);

                        return (
                            <FormItem className="space-y-1">
                                <FormLabel>{renderFieldLabel(field.label)}{checkRequired(field) ? ' *' : ''}</FormLabel>
                                <Select
                                    onValueChange={handleChange}
                                    value={formField.value}
                                >
                                    <FormControl>
                                        <SelectTrigger className={isInvalid ? 'border-red-500' : ''}>
                                            <SelectValue placeholder={getFieldPlaceholder(field)} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className={cn(darkMode && "dark")}>
                                        {/* Filter out duplicate options and empty values */}
                                        {(() => {
                                            const uniqueValues = new Set<string>();
                                            return options
                                                ?.filter(option => {
                                                    if (option.value === "") return false;
                                                    if (uniqueValues.has(option.value)) return false;
                                                    uniqueValues.add(option.value);
                                                    return true;
                                                })
                                                .map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ));
                                        })()}
                                    </SelectContent>
                                </Select>

                                {isInvalid && errorMessage && (
                                    <FormMessage className="text-destructive text-sm font-medium">
                                        {errorMessage}
                                    </FormMessage>
                                )}
                            </FormItem>
                        );
                    }}
                />
            );

        case "required-checkbox":
            return (
                <FormField
                    key={field.id}
                    control={control}
                    name={field.name}
                    rules={getFieldValidation(field)}
                    render={({ field: formField }) => {
                        const isInvalid = shouldShowError(formField.value, checkRequired(field));

                        return (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={formField.value}
                                        onCheckedChange={formField.onChange}
                                        aria-required={checkRequired(field)}
                                        aria-invalid={isInvalid}
                                    />
                                </FormControl>
                                <div className="space-y-2 leading-none">
                                    <FormLabel>{renderFieldLabel(field.label)}{checkRequired(field) && field.label ? ' *' : ''}</FormLabel>
                                    <FormMessage />
                                </div>
                            </FormItem>
                        );
                    }}
                />
            );

        case "yes-no":
            return (
                <FormField
                    key={field.id}
                    control={control}
                    name={field.name}
                    rules={getFieldValidation(field)}
                    render={({ field: formField }) => {
                        const isInvalid = shouldShowError(formField.value, checkRequired(field));

                        return (
                            <FormItem className="flex flex-row items-center justify-between">
                                <FormControl>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            checked={formField.value}
                                            onCheckedChange={formField.onChange}
                                            aria-required={checkRequired(field)}
                                            aria-invalid={isInvalid}
                                            id={field.id}
                                        />
                                        <FormLabel className="font-normal" htmlFor={field.id}>
                                            {renderFieldLabel(field.label)}{checkRequired(field) ? ' *' : ''}
                                        </FormLabel>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />
            );

        case "multiple-choice":
            return (
                <FormField
                    key={`${field.id}-${field.type}`}
                    control={control}
                    name={field.name}
                    rules={getFieldValidation(field)}
                    render={({ field: formField, fieldState }) => {
                        const options = isChoiceField(field) ? field.options : [];
                        const fieldValue = formField.value ? (Array.isArray(formField.value) ? formField.value : [formField.value]) : [];
                        const isInvalid = shouldShowError(formField.value, checkRequired(field));
                        const errorMessage = fieldState.error?.message;

                        // Check if there are values that don't exist in options
                        const missingValues = fieldValue.filter(val => !options.some(o => o.value === val));

                        // Log if values don't exist in options (but don't try to handle it)
                        if (missingValues.length > 0) {
                            // Values not found in options - FormFieldRenderer will display what it's given
                        }

                        return (
                            <FormItem className="space-y-1">
                                <FormLabel>{renderFieldLabel(field.label)}{checkRequired(field) ? ' *' : ''}</FormLabel>
                                <div className="space-y-2">
                                    {/* Filter out duplicate options and empty values */}
                                    {(() => {
                                        const uniqueValues = new Set<string>();
                                        return options
                                            ?.filter(option => {
                                                if (option.value === "") return false;
                                                if (uniqueValues.has(option.value)) return false;
                                                uniqueValues.add(option.value);
                                                return true;
                                            })
                                            .map((option) => (
                                                <FormItem
                                                    key={option.value}
                                                    className="flex flex-row items-start space-x-3 space-y-0"
                                                >
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={fieldValue.includes(option.value)}
                                                            onCheckedChange={(checked) => {
                                                                const updatedValue = [...fieldValue];

                                                                if (checked) {
                                                                    if (!updatedValue.includes(option.value)) {
                                                                        updatedValue.push(option.value);
                                                                    }
                                                                } else {
                                                                    const index = updatedValue.indexOf(option.value);
                                                                    if (index !== -1) {
                                                                        updatedValue.splice(index, 1);
                                                                    }
                                                                }

                                                                formField.onChange(updatedValue);
                                                            }}
                                                            aria-required={checkRequired(field)}
                                                            aria-invalid={isInvalid}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                        {option.label}
                                                    </FormLabel>
                                                </FormItem>
                                            ));
                                    })()}
                                </div>
                                {isInvalid && errorMessage && (
                                    <FormMessage className="text-destructive text-sm font-medium">
                                        {errorMessage}
                                    </FormMessage>
                                )}
                            </FormItem>
                        );
                    }}
                />
            );

        case "contact-info":
            const contactField = field as ContactInfoFieldConfig;
            const contactConfig = contactField.fieldConfig;

            // Get email and phone required flags from field config
            const emailRequired = contactConfig.emailRequired ?? false;
            const phoneRequired = contactConfig.phoneRequired ?? false;
            const firstNameRequired = contactConfig.firstNameRequired ?? true;
            const lastNameRequired = contactConfig.lastNameRequired ?? true;

            return (
                <div key={field.id} className="space-y-6">
                    <div className="grid grid-cols-1 @md/form:grid-cols-2 gap-y-6 gap-x-2 items-start">
                        <FormField
                            control={control}
                            name={`${field.name}.firstName`}
                            rules={getFieldValidation(field, `${field.name}.firstName`)}
                            render={({ field: formField, fieldState }) => {
                                const isInvalid = shouldShowError(formField.value, firstNameRequired);
                                const errorMessage = fieldState.error?.message;

                                return (
                                    <FormItem className="space-y-.5">
                                        <FormLabel>First Name {firstNameRequired ? '*' : ''}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={getFieldPlaceholder(field, `${field.name}.firstName`)}
                                                {...formField}
                                                value={formField.value ?? ""}
                                                aria-required={firstNameRequired}
                                                aria-invalid={isInvalid}
                                                className={isInvalid ? "border-destructive" : ""}
                                                maxLength={MAX_LENGTH.FIRST_NAME}
                                            />
                                        </FormControl>
                                        {isInvalid && errorMessage && (
                                            <FormMessage className="text-destructive text-sm font-medium">
                                                {errorMessage}
                                            </FormMessage>
                                        )}
                                    </FormItem>
                                );
                            }}
                        />
                        <FormField
                            control={control}
                            name={`${field.name}.lastName`}
                            rules={getFieldValidation(field, `${field.name}.lastName`)}
                            render={({ field: formField, fieldState }) => {
                                const isInvalid = shouldShowError(formField.value, lastNameRequired);
                                const errorMessage = fieldState.error?.message;

                                return (
                                    <FormItem className="space-y-.5">
                                        <FormLabel>Last Name {lastNameRequired ? '*' : ''}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={getFieldPlaceholder(field, `${field.name}.lastName`)}
                                                {...formField}
                                                value={formField.value ?? ""}
                                                aria-required={lastNameRequired}
                                                aria-invalid={isInvalid}
                                                className={isInvalid ? "border-destructive" : ""}
                                                maxLength={MAX_LENGTH.LAST_NAME}
                                            />
                                        </FormControl>
                                        {isInvalid && errorMessage && (
                                            <FormMessage className="text-destructive text-sm font-medium">
                                                {errorMessage}
                                            </FormMessage>
                                        )}
                                    </FormItem>
                                );
                            }}
                        />
                        <FormField
                            control={control}
                            name={`${field.name}.email`}
                            rules={getFieldValidation(field, `${field.name}.email`)}
                            render={({ field: formField, fieldState }) => {
                                const isInvalid = shouldShowError(formField.value, emailRequired);
                                const errorMessage = fieldState.error?.message;

                                return (
                                    <FormItem
                                        className="col-span-2 space-y-.5"
                                    >
                                        <FormLabel>Email {emailRequired ? '*' : ''}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder={getFieldPlaceholder(field, `${field.name}.email`)}
                                                {...formField}
                                                value={formField.value ?? ""}
                                                aria-required={emailRequired}
                                                aria-invalid={isInvalid}
                                                className={isInvalid ? "border-destructive" : ""}
                                                maxLength={MAX_LENGTH.EMAIL}
                                            />
                                        </FormControl>
                                        {isInvalid && errorMessage && (
                                            <FormMessage className="text-destructive text-sm font-medium">
                                                {errorMessage}
                                            </FormMessage>
                                        )}
                                    </FormItem>
                                );
                            }}
                        />
                        <FormField
                            control={control}
                            name={`${field.name}.phone`}
                            rules={getFieldValidation(field, `${field.name}.phone`)}
                            render={({ field: formField, fieldState }) => {
                                const isInvalid = shouldShowError(formField.value, phoneRequired);
                                const errorMessage = fieldState.error?.message;

                                return (
                                    <FormItem
                                        className="col-span-2 space-y-.5"
                                    >
                                        <FormLabel>Phone {phoneRequired ? '*' : ''}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="tel"
                                                placeholder={getFieldPlaceholder(field, `${field.name}.phone`)}
                                                {...formField}
                                                value={formField.value ?? ""}
                                                aria-required={phoneRequired}
                                                aria-invalid={isInvalid}
                                                className={isInvalid ? "border-destructive" : ""}
                                                maxLength={MAX_LENGTH.PHONE}
                                            />
                                        </FormControl>
                                        {isInvalid && errorMessage && (
                                            <FormMessage className="text-destructive text-sm font-medium">
                                                {errorMessage}
                                            </FormMessage>
                                        )}
                                    </FormItem>
                                );
                            }}
                        />
                    </div>
                </div>
            );

        case "address":
            // Determine if address fields are required based on the main isRequired setting
            // street2 (apartment) is always optional regardless of the required setting
            const addressRequired = isFieldRequired(field);

            return (
                <div key={field.id} className="space-y-6">
                    <div className="grid grid-cols-1 @md/form:grid-cols-3 gap-y-6 gap-x-2 items-start">
                        <FormField
                            control={control}
                            name={`${field.name}.street`}
                            rules={getFieldValidation(field, `${field.name}.street`)}
                            render={({ field: formField, fieldState }) => {
                                const isInvalid = shouldShowError(formField.value, addressRequired);
                                const errorMessage = fieldState.error?.message;

                                return (
                                    <FormItem
                                        className="col-span-3 space-y-.5"
                                    >
                                        <FormLabel>Street Address {addressRequired ? '*' : ''}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={getFieldPlaceholder(field, `${field.name}.street`)}
                                                {...formField}
                                                value={formField.value ?? ""}
                                                aria-required={addressRequired}
                                                aria-invalid={isInvalid}
                                                className={isInvalid ? "border-destructive" : ""}
                                                maxLength={MAX_LENGTH.STREET}
                                            />
                                        </FormControl>
                                        {isInvalid && errorMessage && (
                                            <FormMessage className="text-destructive text-sm font-medium">
                                                {errorMessage}
                                            </FormMessage>
                                        )}
                                    </FormItem>
                                );
                            }}
                        />
                        <FormField
                            control={control}
                            name={`${field.name}.street2`}
                            rules={getFieldValidation(field, `${field.name}.street2`)}
                            render={({ field: formField, fieldState }) => {
                                // Street2 is always optional
                                const isInvalid = shouldShowError(formField.value, false);
                                const errorMessage = fieldState.error?.message;

                                return (
                                    <FormItem
                                        className="col-span-3 space-y-.5"
                                    >
                                        <FormLabel>Apartment, suite, etc. (optional)</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={getFieldPlaceholder(field, `${field.name}.street2`)}
                                                {...formField}
                                                value={formField.value ?? ""}
                                                aria-required={false}
                                                aria-invalid={isInvalid}
                                                className={isInvalid ? "border-destructive" : ""}
                                                maxLength={MAX_LENGTH.STREET2}
                                            />
                                        </FormControl>
                                        {isInvalid && errorMessage && (
                                            <FormMessage className="text-destructive text-sm font-medium">
                                                {errorMessage}
                                            </FormMessage>
                                        )}
                                    </FormItem>
                                );
                            }}
                        />
                        <FormField
                            control={control}
                            name={`${field.name}.city`}
                            rules={getFieldValidation(field, `${field.name}.city`)}
                            render={({ field: formField, fieldState }) => {
                                const isInvalid = shouldShowError(formField.value, addressRequired);
                                const errorMessage = fieldState.error?.message;

                                return (
                                    <FormItem className="space-y-.5">
                                        <FormLabel>City {addressRequired ? '*' : ''}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={getFieldPlaceholder(field, `${field.name}.city`)}
                                                {...formField}
                                                value={formField.value ?? ""}
                                                aria-required={addressRequired}
                                                aria-invalid={isInvalid}
                                                className={isInvalid ? "border-destructive" : ""}
                                                maxLength={MAX_LENGTH.CITY}
                                            />
                                        </FormControl>
                                        {isInvalid && errorMessage && (
                                            <FormMessage className="text-destructive text-sm font-medium">
                                                {errorMessage}
                                            </FormMessage>
                                        )}
                                    </FormItem>
                                );
                            }}
                        />
                        <FormField
                            control={control}
                            name={`${field.name}.state`}
                            rules={getFieldValidation(field, `${field.name}.state`)}
                            render={({ field: formField, fieldState }) => {
                                const isInvalid = shouldShowError(formField.value, addressRequired);
                                const errorMessage = fieldState.error?.message;

                                return (
                                    <FormItem className="space-y-.5">
                                        <FormLabel>State {addressRequired ? '*' : ''}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={getFieldPlaceholder(field, `${field.name}.state`)}
                                                {...formField}
                                                value={formField.value ?? ""}
                                                aria-required={addressRequired}
                                                aria-invalid={isInvalid}
                                                className={isInvalid ? "border-destructive" : ""}
                                                maxLength={MAX_LENGTH.STATE}
                                            />
                                        </FormControl>
                                        {isInvalid && errorMessage && (
                                            <FormMessage className="text-destructive text-sm font-medium">
                                                {errorMessage}
                                            </FormMessage>
                                        )}
                                    </FormItem>
                                );
                            }}
                        />
                        <FormField
                            control={control}
                            name={`${field.name}.zip`}
                            rules={getFieldValidation(field, `${field.name}.zip`)}
                            render={({ field: formField, fieldState }) => {
                                const isInvalid = shouldShowError(formField.value, addressRequired);
                                const errorMessage = fieldState.error?.message;

                                return (
                                    <FormItem className="space-y-.5">
                                        <FormLabel>ZIP Code {addressRequired ? '*' : ''}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={getFieldPlaceholder(field, `${field.name}.zip`)}
                                                {...formField}
                                                value={formField.value ?? ""}
                                                aria-required={addressRequired}
                                                aria-invalid={isInvalid}
                                                className={isInvalid ? "border-destructive" : ""}
                                                maxLength={MAX_LENGTH.ZIP}
                                            />
                                        </FormControl>
                                        {isInvalid && errorMessage && (
                                            <FormMessage className="text-destructive text-sm font-medium">
                                                {errorMessage}
                                            </FormMessage>
                                        )}
                                    </FormItem>
                                );
                            }}
                        />
                    </div>
                </div>
            );

        default:
            // For unknown field types, we'll handle them as a generic field
            const genericField = field as BaseFieldConfig;

            return (
                <FormField
                    key={genericField.id}
                    control={control}
                    name={genericField.name}
                    rules={getFieldValidation(field)}
                    render={({ field: formField }) => (
                        <FormItem className="space-y-.5">
                            <FormLabel>{renderFieldLabel(genericField.label)}{checkRequired(field) ? ' *' : ''}</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder={getFieldPlaceholder(field)}
                                    {...formField}
                                    value={formField.value ?? ""}
                                    aria-required={checkRequired(field)}
                                    aria-invalid={shouldShowError(formField.value, checkRequired(field))}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            );
    }
};