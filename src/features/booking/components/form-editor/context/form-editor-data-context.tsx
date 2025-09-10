import React, { createContext, useContext, ReactNode } from 'react';
import { FlowNode } from '@/features/booking/components/form-editor/form-flow-tree';
import { FormFieldConfig } from '@/features/booking/lib/form-field-types';
import { FormEditorErrorBoundary } from '../components/FormEditorErrorBoundary';
import { 
    nodeOps, 
    updateNodeInTree, 
    addNodeToTree, 
    removeNodeFromTree, 
    reorderNodesInTree 
} from '../utils/node-operations';
import { validation } from '../utils/validation';

/**
 * BookingFlowData represents the complete serializable form configuration
 * that serves as the single source of truth for the form editor.
 * This structure will eventually be saved to the database.
 */
export interface BookingFlowData {
    id: string;
    internalName: string;              // Admin-only reference name
    slug: string;                      // URL-friendly slug for the form
    serviceTree: FlowNode;             // Root node with full tree structure
    baseQuestions: FormFieldConfig[];  // Questions asked for all services
    theme: 'light' | 'dark';           // Form appearance theme
    primaryColor: string;              // Primary color for UI elements
}

/**
 * Union type defining all possible actions that can modify the form data.
 * Each action has a specific type and payload structure.
 */
export type FormEditorDataAction =
    | { type: 'UPDATE_FORM_SETTINGS'; payload: { internalName?: string; slug?: string; theme?: 'light' | 'dark'; primaryColor?: string } }
    | { type: 'UPDATE_NODE'; payload: { nodeId: string; updates: Partial<FlowNode> } }
    | { type: 'ADD_NODE'; payload: { parentId: string; node: FlowNode } }
    | { type: 'REORDER_NODES'; payload: { parentId: string; newOrder: FlowNode[] } }
    | { type: 'UPDATE_BASE_QUESTIONS'; payload: FormFieldConfig[] }
    | { type: 'INITIALIZE_DATA'; payload: BookingFlowData }
    | { type: 'REMOVE_NODE'; payload: { nodeId: string } };

/**
 * Reducer function for handling state updates based on dispatched actions.
 * All state updates are immutable, creating new state objects rather than modifying existing ones.
 */
export function formEditorDataReducer(state: BookingFlowData, action: FormEditorDataAction): BookingFlowData {
    console.log('🔧 [FormEditorDataReducer] Processing action:', {
        type: action.type,
        payload: action.payload,
        currentState: {
            id: state.id,
            internalName: state.internalName,
            serviceTreeChildren: state.serviceTree?.children?.length || 0
        }
    });

    let newState: BookingFlowData;
    
    switch (action.type) {
        case 'UPDATE_FORM_SETTINGS':
            newState = {
                ...state,
                ...action.payload
            };
            break;
        case 'UPDATE_NODE':
            newState = {
                ...state,
                serviceTree: updateNodeInTree(state.serviceTree, action.payload.nodeId, action.payload.updates)
            };
            break;
        case 'ADD_NODE':
            newState = {
                ...state,
                serviceTree: addNodeToTree(state.serviceTree, action.payload.parentId, action.payload.node)
            };
            break;
        case 'REORDER_NODES':
            newState = {
                ...state,
                serviceTree: reorderNodesInTree(state.serviceTree, action.payload.parentId, action.payload.newOrder)
            };
            break;
        case 'UPDATE_BASE_QUESTIONS':
            newState = {
                ...state,
                baseQuestions: action.payload
            };
            break;
        case 'INITIALIZE_DATA':
            newState = action.payload;
            break;
        case 'REMOVE_NODE':
            newState = {
                ...state,
                serviceTree: removeNodeFromTree(state.serviceTree, action.payload.nodeId)
            };
            break;
        default:
            newState = state;
    }

    console.log('🔧 [FormEditorDataReducer] Action result:', {
        type: action.type,
        stateChanged: newState !== state,
        newState: {
            id: newState.id,
            internalName: newState.internalName,
            serviceTreeChildren: newState.serviceTree?.children?.length || 0
        }
    });

    return newState;
}

// Note: Tree manipulation functions are now imported from utils/node-operations.ts

/**
 * Enhanced context interface with validation and error handling.
 * Simplified to remove dual provider pattern complexity.
 */
export interface FormEditorContextValue {
    data: BookingFlowData;
    dispatch: React.Dispatch<FormEditorDataAction>;
    
    // Auto-save state
    isSaving: boolean;
    lastSaved: Date | null;
    isDirty: boolean;
    
    // Error handling
    errors: string[];
    saveNow: () => Promise<void>;
    
    // Validation utilities
    validateData: () => boolean;
    getValidationErrors: () => string[];
    
    // Node utilities
    nodeOps: typeof nodeOps;
}

const FormEditorDataContext = createContext<FormEditorContextValue | undefined>(undefined);

/**
 * Enhanced provider component with built-in validation and utilities.
 * Simplified interface removes dual provider pattern complexity.
 */
export interface FormEditorDataProviderProps {
    children: ReactNode;
    data: BookingFlowData;
    dispatch: React.Dispatch<FormEditorDataAction>;
    formId: string;
    isSaving?: boolean;
    lastSaved?: Date | null;
    isDirty?: boolean;
    errors?: string[];
    saveNow?: () => Promise<void>;
}

export const FormEditorDataProvider: React.FC<FormEditorDataProviderProps> = ({ 
    children, 
    data,
    dispatch,
    formId,
    isSaving = false,
    lastSaved = null,
    isDirty = false,
    errors = [],
    saveNow = async () => {}
}) => {
    // Validation utilities
    const validateData = React.useCallback((): boolean => {
        const result = validation.validateFormConfig({
            internalName: data.internalName,
            slug: data.slug,
            serviceTree: data.serviceTree,
            baseQuestions: data.baseQuestions,
            theme: data.theme,
            primaryColor: data.primaryColor
        });
        return result.isValid;
    }, [data]);

    const getValidationErrors = React.useCallback((): string[] => {
        const result = validation.validateFormConfig({
            internalName: data.internalName,
            slug: data.slug,
            serviceTree: data.serviceTree,
            baseQuestions: data.baseQuestions,
            theme: data.theme,
            primaryColor: data.primaryColor
        });
        return result.errors.map(error => error.message);
    }, [data]);

    const contextValue: FormEditorContextValue = {
        data,
        dispatch,
        isSaving,
        lastSaved,
        isDirty,
        errors,
        saveNow,
        validateData,
        getValidationErrors,
        nodeOps
    };

    return (
        <FormEditorErrorBoundary 
            onError={(error) => {
                console.error('Form editor error:', error);
                // Could add additional error reporting here
            }}
            showErrorDetails={process.env.NODE_ENV === 'development'}
            context={`FormEditor-${formId}`}
        >
            <FormEditorDataContext.Provider value={contextValue}>
                {children}
            </FormEditorDataContext.Provider>
        </FormEditorErrorBoundary>
    );
};

/**
 * Enhanced custom hook to access the form data context.
 * Provides validation utilities and node operations alongside data access.
 */
export const useFormEditorData = () => {
    const context = useContext(FormEditorDataContext);
    if (!context) {
        throw new Error('useFormEditorData must be used within a FormEditorDataProvider');
    }
    return context;
};

/**
 * Specialized hook for node operations
 */
export const useNodeOperations = () => {
    const { nodeOps: ops, data, dispatch } = useFormEditorData();
    
    const findNode = React.useCallback((nodeId: string) => {
        return ops.findById(data.serviceTree, nodeId);
    }, [ops, data.serviceTree]);
    
    const updateNode = React.useCallback((nodeId: string, updates: Partial<FlowNode>) => {
        dispatch({
            type: 'UPDATE_NODE',
            payload: { nodeId, updates }
        });
    }, [dispatch]);
    
    const addNode = React.useCallback((parentId: string, node: FlowNode) => {
        dispatch({
            type: 'ADD_NODE',
            payload: { parentId, node }
        });
    }, [dispatch]);
    
    const removeNode = React.useCallback((nodeId: string) => {
        dispatch({
            type: 'REMOVE_NODE',
            payload: { nodeId }
        });
    }, [dispatch]);
    
    const reorderNodes = React.useCallback((parentId: string, newOrder: FlowNode[]) => {
        dispatch({
            type: 'REORDER_NODES',
            payload: { parentId, newOrder }
        });
    }, [dispatch]);
    
    return {
        nodeOps: ops,
        findNode,
        updateNode,
        addNode,
        removeNode,
        reorderNodes
    };
};

/**
 * Hook for form validation operations
 */
export const useFormValidation = () => {
    const { validateData, getValidationErrors, data } = useFormEditorData();
    
    const validateTree = React.useCallback(() => {
        return validation.validateTree(data.serviceTree);
    }, [data.serviceTree]);
    
    const validateQuestions = React.useCallback(() => {
        return validation.validateQuestions(data.baseQuestions);
    }, [data.baseQuestions]);
    
    const validateSlug = React.useCallback(() => {
        return validation.validateSlug(data.slug);
    }, [data.slug]);
    
    return {
        validateData,
        getValidationErrors,
        validateTree,
        validateQuestions,
        validateSlug,
        validation
    };
};