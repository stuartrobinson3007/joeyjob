import React, { createContext, useContext, ReactNode } from 'react';
import { FlowNode } from '@/features/booking/components/form-editor/form-flow-tree';
import { FormFieldConfig } from '@/features/booking/lib/form-field-types';
import { FormEditorErrorBoundary } from '../components/FormEditorErrorBoundary';
import { nodeOps } from '../utils/node-operations';
import { validation } from '../utils/validation';
import { BookingFlowData, FormEditorDataAction } from '../types/form-editor-state';

// Note: FormEditorDataAction and formEditorDataReducer have been moved to 
// the enhanced state management system in types/ and reducers/ directories.

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