import { useNavigate } from "@tanstack/react-router";
import { ScrollArea } from "@/ui/scroll-area";
import { FlowNode, NodeType, FormFlowTree } from "@/features/booking/components/form-editor/form-flow-tree";
import BookingFlow from "./booking-flow";
import FormEditorHeader from "./components/form-editor-header";
import FormEditorPreview from "./components/form-editor-preview";
import RootView from "./views/root-view";
import ServicesView from "./views/services-view";
import BrandingView from "./views/branding-view";
import QuestionsView from "./views/questions-view";
import ServiceOptionsView from "./views/service-options-view";
import ServiceDetailsView from "./views/service-details-view";
import SchedulingSettingsView from "./views/scheduling-settings-view";
import ServiceQuestionsView from "./views/service-questions-view";
import GroupDetailsView from "./views/group-details-view";
import { useFormEditorState, NavigationLevel, ServiceDetailView } from "@/features/booking/components/form-editor/hooks/use-form-editor-state";
import { FormEditorDataProvider } from "@/features/booking/components/form-editor/context/form-editor-data-context";
import useFormEditorData from "./hooks/use-form-editor-data";
import { ReactNode, useCallback, useEffect, useState, useRef } from "react";
// TODO: Import BookingState from the new booking-flow component\n// import { BookingState } from "./booking-flow";
import { useForm, UseFormReturn } from "react-hook-form";
import {
    FormFieldConfig,
    ContactInfoFieldConfig,
    AddressFieldConfig,
    ChoiceFieldConfig,
    createDefaultContactInfoConfig,
    createDefaultAddressConfig,
    FormFieldType,
    YesNoFieldConfig,
    SimpleFieldConfig
} from '@/features/booking/lib/form-field-types';
import {
    fieldTypeLabels
} from './form-field-editor';
// Import new API hooks
import { useServices, useCreateService, useUpdateService, useDeleteService } from '@/features/booking/hooks/use-services';
import { useUpdateForm } from '@/features/booking/hooks/use-forms';

interface FormEditorLayoutProps {
    children?: ReactNode;
    formName: string;
    isEnabled?: boolean;
    onToggleEnabled?: () => void;
    flowNodes?: FlowNode; // Prop to receive flow nodes from parent
    selectedNodeId?: string | null; // Prop to receive selected node ID
    onNodeSelect?: (id: string) => void; // Prop to handle node selection
    // TODO: Add proper type for currentForm
    currentForm?: any; // The current form being edited
}

/**
 * Generates the initial form data state structure.
 * This serves as the central source of truth for the form configuration.
 * @param formName The name of the form
 * @param flowNodes The initial tree structure (if provided)
 * @returns A complete BookingFlowData object with defaults for all required fields
 */
const generateInitialFormData = (formName: string, flowNodes: FlowNode | undefined) => {
    // Create the default contact-info field with proper typing
    const contactInfoField: ContactInfoFieldConfig = {
        id: 'contact-info-field',
        name: 'contact_info',
        label: 'Contact Information',
        type: 'contact-info',
        fieldConfig: createDefaultContactInfoConfig()
    };

    // Create the default address field with proper typing
    const addressField: AddressFieldConfig = {
        id: 'address-field',
        name: 'address',
        label: 'Address',
        type: 'address',
        fieldConfig: createDefaultAddressConfig()
    };

    return {
        id: `form-${Date.now()}`,
        internalName: formName,
        serviceTree: flowNodes || {
            id: 'root',
            type: 'start',
            label: 'Start',
            children: []
        },
        baseQuestions: [
            contactInfoField,
            addressField
        ],
        theme: 'light' as const,
        primaryColor: '#3B82F6'
    };
};

/**
 * FormEditorLayoutInner is the main component that integrates:
 * 1. Form data from the FormEditorDataContext (global data state)
 * 2. UI state from useFormEditorState (navigation and selection)
 * 3. UI rendering based on both data sources
 * 
 * This architecture separates concerns:
 * - Data state: What the form contains (services, questions, appearance settings)
 * - UI state: How the user is currently interacting with the form (navigation, selections)
 */

// Inner component that uses the form data context
function FormEditorLayoutInner({
    formName,
    isEnabled = false,
    onToggleEnabled,
    flowNodes,
    selectedNodeId,
    onNodeSelect,
    currentForm
}: FormEditorLayoutProps) {
    const navigate = useNavigate();
    const { data, dispatch } = useFormEditorData();
    
    // TODO: Replace with new API hooks
    // const updateForm = useUpdateForm();

    // TODO: Replace with new Services API hooks
    // Services API hooks
    // const { data: databaseServices = [] } = useServices();
    // const createService = useCreateService();
    // const updateService = useUpdateService();
    // const deleteService = useDeleteService();

    // Mock data for development
    const databaseServices: any[] = [];
    const createService = { mutate: () => {} };
    const updateService = { mutate: () => {} };
    const deleteService = { mutate: () => {} };

    // Auto-save functionality
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedDataRef = useRef<string>('');
    const servicesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isInitializedRef = useRef<boolean>(false);
    const servicesInitializedRef = useRef<boolean>(false);

    // Services synchronization - completely rewritten for robustness
    const syncServicesWithDatabase = useCallback(() => {
        if (!currentForm) return;

        // Extract service nodes from the tree with full context
        const extractServicesFromTree = (node: FlowNode, path: string[] = []): Array<{
            id: string;
            label: string;
            description?: string;
            price?: string;
            path: string[];
            isUUID: boolean;
        }> => {
            const services: Array<{
                id: string;
                label: string;
                description?: string;
                price?: string;
                path: string[];
                isUUID: boolean;
            }> = [];

            if (node.type === 'service') {
                services.push({
                    id: node.id,
                    label: node.label,
                    description: node.description,
                    price: node.price,
                    path: [...path, node.label],
                    isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(node.id)
                });
            }

            if (node.children) {
                for (const child of node.children) {
                    services.push(...extractServicesFromTree(child, [...path, node.label]));
                }
            }

            return services;
        };

        const treeServices = extractServicesFromTree(data.serviceTree);

        // Separate services by type
        const existingServices = treeServices.filter(s => s.isUUID);
        const newServices = treeServices.filter(s => !s.isUUID);

        // For existing services, check if they need updates
        existingServices.forEach(treeService => {
            const dbService = databaseServices.find(db => db.id === treeService.id);

            if (dbService) {
                // Service exists in both places - check for differences
                const hasChanges =
                    dbService.name !== treeService.label ||
                    dbService.description !== (treeService.description || '') ||
                    (treeService.price && dbService.price !== parseFloat(treeService.price.replace('$', '')));

                if (hasChanges) {
                    // TODO: Update existing service
                    /*
                    updateService.mutate({
                        id: dbService.id,
                        name: treeService.label,
                        description: treeService.description || '',
                        duration_minutes: dbService.duration_minutes,
                        price: treeService.price ? parseFloat(treeService.price.replace('$', '')) : dbService.price,
                        active: dbService.active,
                        buffer_time_minutes: dbService.buffer_time_minutes,
                        minimum_notice_hours: dbService.minimum_notice_hours,
                        booking_interval_minutes: dbService.booking_interval_minutes,
                        date_range_type: dbService.date_range_type,
                        rolling_days: dbService.rolling_days,
                        rolling_unit: dbService.rolling_unit,
                        assigned_employee_ids: dbService.assigned_employee_ids
                    });
                    */
                }
            } else {
                // Service has UUID but not found in database - this is unusual
                // Log it but don't create a new service (the UUID might be stale)
                console.warn(`Service with UUID ${treeService.id} not found in database`);
            }
        });

        // Create new services
        newServices.forEach(treeService => {
            // TODO: Create new service
            /*
            createService.mutate({
                name: treeService.label,
                description: treeService.description || '',
                duration_minutes: 60,
                price: treeService.price ? parseFloat(treeService.price.replace('$', '')) : undefined,
                active: true,
                buffer_time_minutes: 15,
                minimum_notice_hours: 24,
                booking_interval_minutes: 30,
                date_range_type: 'rolling' as const,
                rolling_days: 30,
                rolling_unit: 'calendar-days' as const,
                assigned_employee_ids: []
            }, {
                onSuccess: (createdService) => {
                    // Update the tree node to use the new service ID
                    dispatch({
                        type: 'UPDATE_NODE',
                        payload: {
                            nodeId: treeService.id,
                            updates: { id: createdService.id }
                        }
                    });
                }
            });
            */
        });

        // Find services to delete (services in database but not in tree)
        const treeServiceUUIDs = existingServices.map(s => s.id);
        const servicesToDelete = databaseServices.filter(dbService =>
            !treeServiceUUIDs.includes(dbService.id)
        );

        servicesToDelete.forEach(dbService => {
            // TODO: Delete service
            // deleteService.mutate(dbService.id);
        });

    }, [currentForm, data.serviceTree, databaseServices, createService, updateService, deleteService, dispatch]);

    // Add a ref to track the last synced service tree state
    const lastSyncedServicesRef = useRef<string>('');

    // Simplified debounced services sync effect
    useEffect(() => {
        if (!currentForm) return;

        // Create a stable comparison key for services only
        const createServicesKey = () => {
            const extractServices = (node: FlowNode): any[] => {
                const services: any[] = [];
                if (node.type === 'service') {
                    services.push({
                        id: node.id,
                        label: node.label,
                        description: node.description,
                        price: node.price
                    });
                }
                if (node.children) {
                    for (const child of node.children) {
                        services.push(...extractServices(child));
                    }
                }
                return services;
            };
            return JSON.stringify(extractServices(data.serviceTree));
        };

        const currentKey = createServicesKey();

        // Skip on initial load
        if (!servicesInitializedRef.current) {
            lastSyncedServicesRef.current = currentKey;
            servicesInitializedRef.current = true;
            return;
        }

        // Only sync if services actually changed
        if (currentKey !== lastSyncedServicesRef.current) {
            // Clear existing timeout
            if (servicesTimeoutRef.current) {
                clearTimeout(servicesTimeoutRef.current);
            }

            // Set new timeout (3 seconds)
            servicesTimeoutRef.current = setTimeout(() => {
                syncServicesWithDatabase();
                lastSyncedServicesRef.current = currentKey;
            }, 3000);
        }

        // Cleanup
        return () => {
            if (servicesTimeoutRef.current) {
                clearTimeout(servicesTimeoutRef.current);
            }
        };
    }, [data.serviceTree, syncServicesWithDatabase, currentForm]);

    // Simplified auto-save functionality
    const autoSave = useCallback(() => {
        if (!currentForm) return;

        const currentDataString = JSON.stringify({
            name: data.internalName,
            form_config: {
                baseQuestions: data.baseQuestions,
                serviceTree: data.serviceTree,
                theme: data.theme,
                primaryColor: data.primaryColor
            }
        });

        // Only save if data has actually changed
        if (currentDataString !== lastSavedDataRef.current) {
            // TODO: Replace with new API client
            /*
            updateForm.mutate({
                id: currentForm.id,
                name: data.internalName,
                form_config: {
                    baseQuestions: data.baseQuestions,
                    serviceTree: data.serviceTree,
                    theme: data.theme,
                    primaryColor: data.primaryColor
                }
            });
            */
            lastSavedDataRef.current = currentDataString;
        }
    }, [currentForm, data]);

    // Simplified debounced auto-save effect
    useEffect(() => {
        if (!currentForm) return;

        const currentDataString = JSON.stringify({
            name: data.internalName,
            form_config: {
                baseQuestions: data.baseQuestions,
                serviceTree: data.serviceTree,
                theme: data.theme,
                primaryColor: data.primaryColor
            }
        });

        // Skip on initial load
        if (!isInitializedRef.current) {
            lastSavedDataRef.current = currentDataString;
            isInitializedRef.current = true;
            return;
        }

        // Only save if data changed
        if (currentDataString !== lastSavedDataRef.current) {
            // Clear existing timeout
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }

            // Set new timeout (2 seconds)
            autoSaveTimeoutRef.current = setTimeout(() => {
                autoSave();
            }, 2000);
        }

        // Cleanup
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [data.internalName, data.baseQuestions, data.serviceTree, data.theme, data.primaryColor, autoSave, currentForm]);

    // Use our extracted state management hook for UI state only
    const [state, actions] = useFormEditorState(
        data.serviceTree,
        selectedNodeId,
        onNodeSelect
    );

    // State to store the booking flow title (from Start node)
    const [bookingFlowTitle, setBookingFlowTitle] = useState<string>('Book your service');

    // State to store the services data for the booking flow preview
    const [servicesData, setServicesData] = useState<any[]>([]);

    // Create the form methods at the FormEditorLayout level
    const formMethods = useForm({
        defaultValues: {
            // Initialize with the same default structure that BookingFlow uses
            // for contact_info and address fields
            contact_info: {
                firstName: "",
                lastName: "",
                email: "",
                phone: ""
            },
            address: {
                street: "",
                street2: "",
                city: "",
                state: "",
                zip: ""
            },
            // Also add fields for the field IDs for backward compatibility
            'contact-info-field': {
                firstName: "",
                lastName: "",
                email: "",
                phone: ""
            },
            'address-field': {
                street: "",
                street2: "",
                city: "",
                state: "",
                zip: ""
            }
            // Note: Dynamic fields from service-specific questions will be added at runtime
        }
    });

    // Add booking state (without formData)
    const [bookingState, setBookingState] = useState<BookingState>({
        stage: 'selection',
        navigationPath: [],
        selectedService: null,
        selectedDate: null,
        selectedTime: null
    });

    // Helper function to update the question options in the form config
    const updateQuestionOptions = useCallback((questionId: string, oldValue: string, newValue: string) => {
        // First try to find and update in base questions
        const baseQuestionIndex = data.baseQuestions.findIndex(q => q.id === questionId);

        if (baseQuestionIndex !== -1 && 'options' in data.baseQuestions[baseQuestionIndex]) {
            // Question found in base questions
            const updatedQuestions = [...data.baseQuestions];
            let updatedOptions = [...(updatedQuestions[baseQuestionIndex] as any).options || []];

            // Handle option removal
            if (newValue === '') {
                updatedOptions = updatedOptions.filter(opt => opt.value !== oldValue);
            } else {
                // Handle option update
                updatedOptions = updatedOptions.map(opt =>
                    opt.value === oldValue ? { value: newValue, label: newValue } : opt
                );
            }

            updatedQuestions[baseQuestionIndex] = {
                ...updatedQuestions[baseQuestionIndex],
                options: updatedOptions
            } as FormFieldConfig;

            dispatch({
                type: 'UPDATE_BASE_QUESTIONS',
                payload: updatedQuestions
            });
            return;
        }

        // If not found in base questions, search in service questions
        const updateServiceNodeQuestions = (node: FlowNode): boolean => {
            if (!node) return false;

            // Check if this node has the question
            if (node.additionalQuestions) {
                const questionIndex = node.additionalQuestions.findIndex(q => q.id === questionId);

                if (questionIndex !== -1 && 'options' in node.additionalQuestions[questionIndex]) {
                    // Found the question in this node's additional questions
                    const updatedQuestions = [...node.additionalQuestions];
                    let updatedOptions = [...(updatedQuestions[questionIndex] as any).options || []];

                    // Handle option removal
                    if (newValue === '') {
                        updatedOptions = updatedOptions.filter(opt => opt.value !== oldValue);
                    } else {
                        // Handle option update
                        updatedOptions = updatedOptions.map(opt =>
                            opt.value === oldValue ? { value: newValue, label: newValue } : opt
                        );
                    }

                    updatedQuestions[questionIndex] = {
                        ...updatedQuestions[questionIndex],
                        options: updatedOptions
                    } as FormFieldConfig;

                    // Update the node with modified questions
                    dispatch({
                        type: 'UPDATE_NODE',
                        payload: {
                            nodeId: node.id,
                            updates: { additionalQuestions: updatedQuestions }
                        }
                    });

                    return true;
                }
            }

            // If not found in this node, recursively check children
            if (node.children) {
                for (const child of node.children) {
                    if (updateServiceNodeQuestions(child)) {
                        return true;
                    }
                }
            }

            return false;
        };

        // Start the search from the service tree root
        updateServiceNodeQuestions(data.serviceTree);
    }, [data.baseQuestions, data.serviceTree, dispatch]);

    // Handle option value changes (options for dropdown, multiple-choice, etc.)
    const handleOptionValueChange = useCallback((questionId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) => {
        // Find the question config to get the field name
        const questionConfig = data.baseQuestions.find(q => q.id === questionId) ||
            data.serviceTree.children?.flatMap(s => s.additionalQuestions || []).find(q => q.id === questionId);

        if (!questionConfig) {
            return;
        }

        const fieldName = questionConfig.name;

        if (eventType === 'option-change') {
            // Option change logic:
            // 1. Check if we need to update the form value (if value changes or is removed)
            // 2. Update the question definition to update the option label

            // Option removal (newValue is empty)
            if (newValue === '' && oldValue !== '') {
                // 1. Check if the current form value uses this option
                const formValue = formMethods.getValues(fieldName as any);

                // For single-select fields (dropdown, radio)
                if (typeof formValue === 'string' && formValue === oldValue) {
                    // Reset to empty string if the selected option is removed
                    formMethods.setValue(fieldName as any, '', { shouldValidate: false });
                }

                // For multiple-choice fields (array values)
                else if (Array.isArray(formValue) && formValue.includes(oldValue)) {
                    // Remove the deleted option from the selected values
                    const newFormValue = formValue.filter(val => val !== oldValue);
                    formMethods.setValue(fieldName as any, newFormValue, { shouldValidate: false });
                }

                // 2. Update the question definition (remove the option)
                updateQuestionOptions(questionId, oldValue, newValue);
            }
            // Option value change (newValue is not empty)
            else if (newValue !== oldValue) {
                // 1. Check if form value needs update
                const formValue = formMethods.getValues(fieldName as any);

                // For single select fields
                if (typeof formValue === 'string' && formValue === oldValue) {
                    // Update to new value
                    formMethods.setValue(fieldName as any, newValue, { shouldValidate: false });
                }

                // For multiple choice fields
                else if (Array.isArray(formValue) && formValue.includes(oldValue)) {
                    // Replace old value with new value in the array
                    const newFormValue = formValue.map(val => val === oldValue ? newValue : val);
                    formMethods.setValue(fieldName as any, newFormValue, { shouldValidate: false });
                }

                // 2. Update the question definition (update the option)
                updateQuestionOptions(questionId, oldValue, newValue);
            }
        }
        else if (eventType === 'value-update') {
            // Direct value updates from field editors
            formMethods.setValue(fieldName as any, newValue, { shouldValidate: false });
        }
    }, [formMethods, data.baseQuestions, data.serviceTree.children, updateQuestionOptions]);

    // Initialize booking flow title from serviceTree on mount
    useEffect(() => {
        // Helper function to find the start node in the tree
        const findStartNode = (node: FlowNode): FlowNode | null => {
            if (node.type === 'start') return node;
            if (node.children) {
                for (const child of node.children) {
                    const found = findStartNode(child);
                    if (found) return found;
                }
            }
            return null;
        };

        const startNode = findStartNode(data.serviceTree);
        if (startNode && startNode.label && startNode.label !== 'Start') {
            setBookingFlowTitle(startNode.label);
        }
    }, [data.serviceTree]);

    // Helper to find question config and its location
    const findQuestionConfigAndLocation = useCallback((questionId: string): { config: FormFieldConfig | null; location: 'base' | 'service'; parentNodeId?: string } => {
        // Check base questions first
        const baseQuestion = data.baseQuestions.find(q => q.id === questionId);
        if (baseQuestion) {
            return { config: baseQuestion, location: 'base' };
        }

        // Recursively search service tree
        const findInNode = (node: FlowNode): { config: FormFieldConfig | null; parentNodeId?: string } => {
            if (node.additionalQuestions) {
                const question = node.additionalQuestions.find(q => q.id === questionId);
                if (question) {
                    return { config: question, parentNodeId: node.id };
                }
            }
            if (node.children) {
                for (const child of node.children) {
                    const found = findInNode(child);
                    if (found.config) {
                        return found;
                    }
                }
            }
            return { config: null };
        };

        const serviceSearchResult = findInNode(data.serviceTree);
        if (serviceSearchResult.config) {
            return { config: serviceSearchResult.config, location: 'service', parentNodeId: serviceSearchResult.parentNodeId };
        }

        return { config: null, location: 'base' }; // Default or indicate not found
    }, [data.baseQuestions, data.serviceTree]);

    // Enhanced handler for field type changes
    const handleFieldTypeChange = useCallback((fieldId: string, oldType: FormFieldType, newType: FormFieldType) => {
        const { config: currentConfig, location, parentNodeId } = findQuestionConfigAndLocation(fieldId);

        if (!currentConfig) {
            console.error(`Field config not found for ID: ${fieldId} during type change.`);
            return;
        }

        const fieldName = currentConfig.name;

        // --- 1. Clear React Hook Form State --- 
        try {
            formMethods.unregister(fieldName as any);

            // Set appropriate default empty value based on the NEW type
            if (newType === 'contact-info') {
                formMethods.setValue(`${fieldName}.firstName` as any, '', { shouldValidate: false });
                formMethods.setValue(`${fieldName}.lastName` as any, '', { shouldValidate: false });
                formMethods.setValue(`${fieldName}.email` as any, '', { shouldValidate: false });
                formMethods.setValue(`${fieldName}.phone` as any, '', { shouldValidate: false });
            } else if (newType === 'address') {
                formMethods.setValue(`${fieldName}.street` as any, '', { shouldValidate: false });
                formMethods.setValue(`${fieldName}.street2` as any, '', { shouldValidate: false });
                formMethods.setValue(`${fieldName}.city` as any, '', { shouldValidate: false });
                formMethods.setValue(`${fieldName}.state` as any, '', { shouldValidate: false });
                formMethods.setValue(`${fieldName}.zip` as any, '', { shouldValidate: false });
            } else if (newType === 'multiple-choice') {
                formMethods.setValue(fieldName as any, [], { shouldValidate: false });
            } else if (newType === 'yes-no' || newType === 'required-checkbox') {
                formMethods.setValue(fieldName as any, false, { shouldValidate: false }); // Default boolean to false
            } else if (newType === 'date') {
                formMethods.setValue(fieldName as any, '', { shouldValidate: false });
            } else {
                formMethods.setValue(fieldName as any, '', { shouldValidate: false });
            }

            formMethods.clearErrors(fieldName as any);
        } catch (error) {
            console.error('Error clearing form state during field type change:', error);
        }

        // --- 2. Create New Field Config with Defaults (Logic moved from QuestionList) --- 
        let newField: FormFieldConfig;
        const baseNewField = { ...currentConfig, type: newType }; // Start with existing config, override type

        if (newType === 'dropdown' || newType === 'multiple-choice') {
            newField = {
                ...baseNewField,
                options: [
                    { value: 'Option 1', label: 'Option 1' },
                    { value: 'Option 2', label: 'Option 2' }
                ]
            } as ChoiceFieldConfig;
        } else if (newType === 'yes-no') {
            newField = {
                ...baseNewField,
                isRequired: false // Always false for yes/no
            } as YesNoFieldConfig;
        } else if (newType === 'required-checkbox') {
            newField = {
                ...baseNewField,
                isRequired: true // Always true for required-checkbox
            } as FormFieldConfig; // Adjust type if specific config exists
        } else if (newType === 'contact-info') {
            newField = {
                ...baseNewField,
                fieldConfig: createDefaultContactInfoConfig()
            } as ContactInfoFieldConfig;
        } else if (newType === 'address') {
            newField = {
                ...baseNewField,
                fieldConfig: createDefaultAddressConfig()
            } as AddressFieldConfig;
        } else {
            // Simple fields (short-text, long-text, date, file-upload)
            newField = { ...baseNewField } as SimpleFieldConfig;
        }

        // Apply default label based on the new type if the label seems generic or empty
        // You might want more sophisticated logic here
        const genericLabels = ['Short Text Question', 'Long Text Question', 'Date Question', 'Dropdown Question', 'Multiple Choice Question', 'Yes/No Question', 'I agree to the terms and conditions', 'Upload Files', ''];
        if (!newField.label || genericLabels.includes(newField.label) || newField.label === fieldTypeLabels[oldType]) {
            switch (newType) {
                case 'contact-info': newField.label = 'Contact Information'; break;
                case 'address': newField.label = 'Address'; break;
                case 'dropdown': newField.label = 'Select an option'; break;
                case 'multiple-choice': newField.label = 'Select all that apply'; break;
                case 'yes-no': newField.label = 'Yes/No Question'; break;
                case 'required-checkbox': newField.label = 'I agree to the terms and conditions'; break;
                case 'file-upload': newField.label = 'Upload Files'; break;
                case 'short-text': newField.label = 'Short Text Question'; break;
                case 'long-text': newField.label = 'Long Text Question'; break;
                case 'date': newField.label = 'Date Question'; break;
                default: newField.label = `New ${fieldTypeLabels[newType]} Question`;
            }
        }

        // --- 3. Dispatch State Update --- 
        if (location === 'base') {
            const updatedBaseQuestions = data.baseQuestions.map(q => q.id === fieldId ? newField : q);
            dispatch({ type: 'UPDATE_BASE_QUESTIONS', payload: updatedBaseQuestions });
        } else if (location === 'service' && parentNodeId) {
            // Need to find the parent node again to get its current questions
            const parentNode = findNodeById(data.serviceTree, parentNodeId);
            if (parentNode && parentNode.additionalQuestions) {
                const updatedNodeQuestions = parentNode.additionalQuestions.map(q => q.id === fieldId ? newField : q);
                dispatch({
                    type: 'UPDATE_NODE',
                    payload: { nodeId: parentNodeId, updates: { additionalQuestions: updatedNodeQuestions } }
                });
            }
        }

    }, [dispatch, findQuestionConfigAndLocation, data.baseQuestions, data.serviceTree, formMethods]);

    // Update services data when serviceTree changes
    useEffect(() => {
        const convertedServices = convertFlowNodesToServices(data.serviceTree);
        if (convertedServices.length > 0) {
            setServicesData(convertedServices);
        }
    }, [data.serviceTree]);

    // Function to convert FormFlowTree nodes to BookingFlow service structure
    const convertFlowNodesToServices = (node: FlowNode): any[] => {
        if (!node || !node.children || node.children.length === 0) {
            return [];
        }

        // If this is a start node, set the booking flow title
        if (node.type === 'start' && node.label && node.label !== 'Start') {
            setBookingFlowTitle(node.label);
        }

        // When walking the tree, also look for a start node to use its title
        const findStartNodeInTree = (currentNode: FlowNode) => {
            if (currentNode.type === 'start' && currentNode.label && currentNode.label !== 'Start') {
                setBookingFlowTitle(currentNode.label);
            }

            if (currentNode.children) {
                currentNode.children.forEach(findStartNodeInTree);
            }
        };

        // Start the search from the current node
        findStartNodeInTree(node);

        return node.children.map(child => {
            if (child.type === 'split') {
                // This is a group node
                return {
                    id: child.id,
                    type: 'group',
                    title: child.label,
                    description: child.description || 'Group of services', // Use description if available
                    children: child.children ? convertFlowNodesToServices(child) : []
                };
            } else if (child.type === 'service') {
                // Extract service properties from the node data if available
                const servicePrice = child.price || '$99';
                const serviceDuration = child.duration || 60;
                const serviceDescription = child.description || 'Book this service';
                const serviceBufferTime = child.bufferTime || 15;
                const serviceInterval = child.interval || 30;
                const serviceAvailabilityRules = child.availabilityRules || [
                    {
                        days: [1, 2, 3, 4, 5], // Monday-Friday
                        timeRanges: [
                            { start: "09:00", end: "12:00" },
                            { start: "13:00", end: "17:00" }
                        ]
                    }
                ];
                const serviceBlockedTimes = child.blockedTimes || [];
                const serviceUnavailableDates = child.unavailableDates || [];
                const serviceAdditionalQuestions = child.additionalQuestions || [];

                // This is a service node
                return {
                    id: child.id,
                    type: 'service',
                    title: child.label,
                    description: serviceDescription,
                    duration: serviceDuration,
                    price: servicePrice,
                    availabilityRules: serviceAvailabilityRules,
                    blockedTimes: serviceBlockedTimes,
                    unavailableDates: serviceUnavailableDates,
                    bufferTime: serviceBufferTime,
                    interval: serviceInterval,
                    additionalQuestions: serviceAdditionalQuestions
                };
            }
            return null;
        }).filter(Boolean);
    };

    // Handle node selection
    const handleNodeSelect = useCallback((nodeId: string) => {
        actions.selectNode(nodeId);
        if (onNodeSelect) onNodeSelect(nodeId);
    }, [actions, state.currentLevel, onNodeSelect]);

    // Handle node update
    const handleUpdateNode = useCallback((nodeId: string, updates: Partial<FlowNode>) => {
        dispatch({
            type: 'UPDATE_NODE',
            payload: { nodeId, updates }
        });
    }, [data.serviceTree, state.selectedNodeId, state.currentLevel, dispatch]);

    // Function to update a node in the tree
    const updateNodeInTree = (node: FlowNode, nodeId: string, updates: Partial<FlowNode>): FlowNode => {
        if (node.id === nodeId) {
            return { ...node, ...updates };
        }

        if (node.children) {
            return {
                ...node,
                children: node.children.map((child) => updateNodeInTree(child, nodeId, updates)),
            };
        }

        return node;
    };

    // Function to find a node by ID
    const findNodeById = (node: FlowNode, id: string): FlowNode | null => {
        if (node.id === id) return node;

        if (node.children) {
            for (const child of node.children) {
                const found = findNodeById(child, id);
                if (found) return found;
            }
        }

        return null;
    };

    // Common navigation and UI handlers
    const handleExit = () => {
        navigate({ to: "/forms" });
    };

    const handleOpenPreview = () => {
        // Open form preview in new tab
        window.open("/form-preview", "_blank");
    };

    const handleEmbed = () => {
        // Show embed code - to be implemented
    };

    const handleDelete = () => {
        // Delete form - to be implemented
    };

    // Handle booking submission for preview
    const handleBookingSubmit = (bookingData: any) => {
        // Process booking submission - to be implemented
    };

    // Helper function to find a node by ID
    const handleFormSettingsUpdate = (updates: { internalName?: string; theme?: 'light' | 'dark'; primaryColor?: string }) => {
        dispatch({
            type: 'UPDATE_FORM_SETTINGS',
            payload: updates
        });
    };

    // Effect to handle navigation state changes
    useEffect(() => {
        // Intentionally left empty
    }, [state.currentLevel, state.selectedNodeId, data.serviceTree]);

    // Effect to handle service tree changes
    useEffect(() => {
        // Intentionally left empty
    }, [data.serviceTree, state.selectedNodeId, state.currentLevel]);

    // Handle booking state changes
    const handleBookingStateChange = (newState: BookingState) => {
        // If service changed, we need to handle form reset logic
        if (newState.selectedService?.id !== bookingState.selectedService?.id) {
            // Get questions for the old service
            const oldServiceId = bookingState.selectedService?.id;
            const oldServiceNode = oldServiceId ? findNodeById(data.serviceTree, oldServiceId) : null;
            const oldServiceQuestions = oldServiceNode?.additionalQuestions || [];

            // Get questions for the new service
            const newServiceId = newState.selectedService?.id;
            const newServiceNode = newServiceId ? findNodeById(data.serviceTree, newServiceId) : null;
            const newServiceQuestions = newServiceNode?.additionalQuestions || [];

            // Keep base form values but reset service-specific fields
            if (oldServiceQuestions.length > 0 || newServiceQuestions.length > 0) {
                const currentValues = formMethods.getValues();

                // Clear values for fields that are no longer relevant
                const fieldsToReset = oldServiceQuestions
                    .filter(oldQ => !newServiceQuestions.some(newQ => newQ.name === oldQ.name))
                    .map(q => q.name);

                // Create reset data keeping base fields intact
                const resetData = { ...currentValues };
                fieldsToReset.forEach(name => {
                    resetData[name as keyof typeof resetData] = "" as any;
                });

                // Apply the reset
                formMethods.reset(resetData);
            }
        }

        // Always update booking state
        setBookingState(newState);
    };

    /**
     * Renders the appropriate view component based on the current navigation level from UI state.
     * Each view receives:
     * 1. Form data props from the context
     * 2. UI action handlers to update both form data and UI state
     * 3. Navigation handlers to move between different views
     */
    // Render the current view based on navigation state
    const renderCurrentView = () => {
        switch (state.currentLevel) {
            case "root":
                return (
                    <RootView
                        formName={data.internalName}
                        onFormNameChange={(name) => handleFormSettingsUpdate({ internalName: name })}
                        onNavigate={actions.navigateToLevel}
                    />
                );
            case "services":
                return (
                    <ServicesView
                        onNavigateBack={actions.navigateBack}
                        servicesContent={renderServicesContent()}
                        onAddService={() => {
                            // Add service to root node
                            const newNode: FlowNode = {
                                id: `node-${Date.now()}`,
                                type: "service",
                                label: "New Service",
                                additionalQuestions: []
                            };

                            dispatch({
                                type: 'ADD_NODE',
                                payload: { parentId: data.serviceTree.id, node: newNode }
                            });

                            if (onNodeSelect) {
                                onNodeSelect(newNode.id);
                            }
                            setTimeout(() => {
                                actions.navigateToLevel("service-details");
                            }, 0);
                        }}
                        onAddGroup={() => {
                            // Add group to root node
                            const newNode: FlowNode = {
                                id: `node-${Date.now()}`,
                                type: "split",
                                label: "New Group"
                            };

                            dispatch({
                                type: 'ADD_NODE',
                                payload: { parentId: data.serviceTree.id, node: newNode }
                            });

                            if (onNodeSelect) {
                                onNodeSelect(newNode.id);
                            }
                            setTimeout(() => {
                                actions.navigateToLevel("group-details");
                            }, 0);
                        }}
                    />
                );
            case "questions":
                return (
                    <QuestionsView
                        onNavigateBack={actions.navigateBack}
                        onOptionValueChange={(questionId, eventType, oldValue, newValue) =>
                            handleOptionValueChange(questionId, eventType, oldValue, newValue)
                        }
                        onFieldTypeChange={handleFieldTypeChange}
                    />
                );
            case "branding":
                return (
                    <BrandingView
                        onNavigateBack={actions.navigateBack}
                        formTheme={data.theme}
                        primaryColor={data.primaryColor}
                        onFormThemeChange={(theme) => handleFormSettingsUpdate({ theme })}
                        onPrimaryColorChange={(color) => handleFormSettingsUpdate({ primaryColor: color })}
                    />
                );
            case "group-details":
                // Safe check: if selectedNode is null, go back to services view
                if (!state.selectedNode) {
                    // Try to find the node if we have its ID
                    if (state.selectedNodeId) {
                        const node = findNodeById(data.serviceTree, state.selectedNodeId);
                        if (node) {
                            // Found the node, update the state
                            actions.updateSelectedNodeOnly(node);
                            // Then render with the node
                            return (
                                <GroupDetailsView
                                    node={node}
                                    onNavigateBack={actions.navigateBack}
                                    onUpdateNode={handleUpdateNode}
                                />
                            );
                        }
                    }
                    // If we reach here, go back to services
                    setTimeout(() => actions.navigateToLevel("services"), 0);
                    return null;
                }
                // Normal case with selectedNode available
                return (
                    <GroupDetailsView
                        node={state.selectedNode}
                        onNavigateBack={actions.navigateBack}
                        onUpdateNode={handleUpdateNode}
                    />
                );
            case "service-details":
                // Safe check: if selectedNode is null, go back to services view
                if (!state.selectedNode) {
                    // Try to find the node if we have its ID
                    if (state.selectedNodeId) {
                        const node = findNodeById(data.serviceTree, state.selectedNodeId);
                        if (node) {
                            // Found the node, update the state
                            actions.updateSelectedNodeOnly(node);
                            // Then render with the node
                            return (
                                <ServiceOptionsView
                                    node={node}
                                    onNavigateBack={actions.navigateBack}
                                    onNavigateToDetail={actions.navigateToServiceDetail}
                                    activeView={state.serviceDetailView}
                                />
                            );
                        }
                    }
                    // If we reach here, go back to services
                    setTimeout(() => actions.navigateToLevel("services"), 0);
                    return null;
                }
                // Normal case with selectedNode available
                return (
                    <ServiceOptionsView
                        node={state.selectedNode}
                        onNavigateBack={actions.navigateBack}
                        onNavigateToDetail={actions.navigateToServiceDetail}
                        activeView={state.serviceDetailView}
                    />
                );
            case "service-details-form":
                // Safe check: if selectedNode is null, go back to services view
                if (!state.selectedNode) {
                    // Try to find the node if we have its ID
                    if (state.selectedNodeId) {
                        const node = findNodeById(data.serviceTree, state.selectedNodeId);
                        if (node) {
                            // Found the node, update the state
                            actions.updateSelectedNodeOnly(node);
                            // Then render with the node
                            return (
                                <ServiceDetailsView
                                    node={node}
                                    onNavigateBack={actions.navigateBack}
                                    onUpdateNode={handleUpdateNode}
                                />
                            );
                        }
                    }
                    // If we reach here, go back to services
                    setTimeout(() => actions.navigateToLevel("services"), 0);
                    return null;
                }
                // Normal case with selectedNode available
                return (
                    <ServiceDetailsView
                        node={state.selectedNode}
                        onNavigateBack={actions.navigateBack}
                        onUpdateNode={handleUpdateNode}
                    />
                );
            case "service-scheduling":
                // Safe check: if selectedNode is null, go back to services view
                if (!state.selectedNode) {
                    // Try to find the node if we have its ID
                    if (state.selectedNodeId) {
                        const node = findNodeById(data.serviceTree, state.selectedNodeId);
                        if (node) {
                            // Found the node, update the state
                            actions.updateSelectedNodeOnly(node);
                            // Then render with the node
                            return (
                                <SchedulingSettingsView
                                    node={node}
                                    onNavigateBack={actions.navigateBack}
                                    onUpdateNode={handleUpdateNode}
                                />
                            );
                        }
                    }
                    // If we reach here, go back to services
                    setTimeout(() => actions.navigateToLevel("services"), 0);
                    return null;
                }
                // Normal case with selectedNode available
                return (
                    <SchedulingSettingsView
                        node={state.selectedNode}
                        onNavigateBack={actions.navigateBack}
                        onUpdateNode={handleUpdateNode}
                    />
                );
            case "service-questions":
                // Safe check: if selectedNode is null, go back to services view
                if (!state.selectedNode) {
                    // Try to find the node if we have its ID
                    if (state.selectedNodeId) {
                        const node = findNodeById(data.serviceTree, state.selectedNodeId);
                        if (node) {
                            // Found the node, update the state
                            actions.updateSelectedNodeOnly(node);
                            // Then render with the node
                            return (
                                <ServiceQuestionsView
                                    node={node}
                                    onNavigateBack={actions.navigateBack}
                                    onUpdateNode={handleUpdateNode}
                                    baseQuestions={data.baseQuestions}
                                    onOptionValueChange={(questionId, eventType, oldValue, newValue) =>
                                        handleOptionValueChange(questionId, eventType, oldValue, newValue)
                                    }
                                    onFieldTypeChange={handleFieldTypeChange}
                                />
                            );
                        }
                    }
                    // If we reach here, go back to services
                    setTimeout(() => actions.navigateToLevel("services"), 0);
                    return null;
                }
                // Normal case with selectedNode available
                return (
                    <ServiceQuestionsView
                        node={state.selectedNode}
                        onNavigateBack={actions.navigateBack}
                        onUpdateNode={handleUpdateNode}
                        baseQuestions={data.baseQuestions}
                        onOptionValueChange={(questionId, eventType, oldValue, newValue) =>
                            handleOptionValueChange(questionId, eventType, oldValue, newValue)
                        }
                        onFieldTypeChange={handleFieldTypeChange}
                    />
                );
            default:
                return (
                    <RootView
                        formName={data.internalName}
                        onFormNameChange={(name) => handleFormSettingsUpdate({ internalName: name })}
                        onNavigate={actions.navigateToLevel}
                    />
                );
        }
    };

    // Render the booking flow preview with connected settings
    const renderPreview = () => {
        // Create a callback function to get the most up-to-date service by ID
        const getServiceById = (serviceId: string) => {
            if (!serviceId) return null;

            // Helper function to find service by ID recursively in the tree
            const findServiceInTree = (items: any[]): any => {
                if (!items || !Array.isArray(items)) return null;

                for (const item of items) {
                    if (!item) continue;
                    if (item.id === serviceId) return item;
                    if (item.type === 'group' && item.children && Array.isArray(item.children)) {
                        const found = findServiceInTree(item.children);
                        if (found) return found;
                    }
                }
                return null;
            };

            // Find the service in the current services data
            return findServiceInTree(servicesData);
        };

        return (
            <FormEditorPreview
                darkMode={data.theme === "dark"}>
                <BookingFlow
                    id="form-editor-preview"
                    startTitle={bookingFlowTitle}
                    startDescription={state.selectedNode?.description || "Select a service to get started"}
                    services={servicesData}
                    baseQuestions={data.baseQuestions}
                    primaryColor={data.primaryColor}
                    darkMode={data.theme === "dark"}
                    onBookingSubmit={handleBookingSubmit}
                    getServiceById={getServiceById}
                    bookingState={bookingState}
                    onBookingStateChange={handleBookingStateChange}
                    formMethods={formMethods}
                    onOptionValueChange={(questionId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) =>
                        handleOptionValueChange(questionId, eventType, oldValue, newValue)
                    }
                />
            </FormEditorPreview>
        );
    };

    /**
     * Renders the services tree with handlers that dispatch directly to the form data context.
     * This ensures that all tree operations (add, update, remove, reorder) update the central state.
     */
    const renderServicesContent = () => {
        const handleNodeAction = (id: string, action: string) => {
            if (action === 'delete') {
                dispatch({
                    type: 'REMOVE_NODE',
                    payload: { nodeId: id }
                });
            }
        };

        const handleAddNode = (parentId: string, type: NodeType) => {
            // Create a new node
            const newNode: FlowNode = {
                id: `node-${Date.now()}`,
                type,
                label: type === "split" ? "New Group" : "New Service",
                // Ensure service nodes don't have any questions by default
                ...(type === "service" ? { additionalQuestions: [] } : {})
            };

            // First update the data context
            dispatch({
                type: 'ADD_NODE',
                payload: { parentId, node: newNode }
            });

            if (onNodeSelect) {
                onNodeSelect(newNode.id);
            }
            setTimeout(() => {
                // Then update the UI state to navigate to the node
                if (type === "split") {
                    actions.navigateToLevel("group-details");
                } else if (type === "service") {
                    actions.navigateToLevel("service-details");
                }
            }, 0);
        };

        const handleReorder = (parentId: string, newOrder: FlowNode[]) => {
            dispatch({
                type: 'REORDER_NODES',
                payload: { parentId, newOrder }
            });
        };

        return (
            <div className="w-full">
                <FormFlowTree
                    data={data.serviceTree}
                    onNodeAction={handleNodeAction}
                    onAddNode={handleAddNode}
                    onReorder={handleReorder}
                    onNodeSelect={(id) => {
                        actions.selectNode(id);
                        if (onNodeSelect) onNodeSelect(id);
                    }}
                />
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Top bar with header */}
            <FormEditorHeader
                formName={data.internalName}
                isEnabled={isEnabled}
                onToggleEnabled={onToggleEnabled}
                onExit={handleExit}
                onOpenPreview={handleOpenPreview}
                onEmbed={handleEmbed}
                onDelete={handleDelete}
                isMobile={state.isMobile}
            />

            {/* Main content - left panel and preview */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left panel - Navigation */}
                <div className={`${state.isMobile ? 'w-full' : 'w-sm lg:w-lg'} flex flex-col relative overflow-hidden`}>
                    <ScrollArea className="h-full w-full">
                        <div className="px-4 md:px-6 lg:px-8 md:pt-3 flex flex-col items-stretch h-full pb-6 overflow-hidden">
                            {renderCurrentView()}
                        </div>
                    </ScrollArea>
                </div>

                {/* Right panel - Preview (only shown on desktop) */}
                {!state.isMobile && renderPreview()}
            </div>
        </div>
    );
}

/**
 * Main layout component that establishes the form data context and connects it with UI state.
 * The architecture:
 * - FormEditorDataProvider: Provides global form data state
 * - FormEditorLayoutInner: Connects form data with UI state and renders appropriate views
 * - Each view component: Uses both data sources to render and update specific parts of the form
 */

// Main export component that wraps with provider
export function FormEditorLayout(props: FormEditorLayoutProps) {
    const initialFormData = generateInitialFormData(props.formName, props.flowNodes);

    return (
        <FormEditorDataProvider initialData={initialFormData}>
            <FormEditorLayoutInner {...props} />
        </FormEditorDataProvider>
    );
}