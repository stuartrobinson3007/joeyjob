import React, { createContext, useContext, ReactNode } from 'react';
import { FlowNode } from '@/features/booking/components/form-editor/form-flow-tree';
import { FormFieldConfig } from '@/features/booking/lib/form-field-types';
import { FormErrorBoundary } from '@/taali/components/form/form-error-boundary';

/**
 * BookingFlowData represents the complete serializable form configuration
 * that serves as the single source of truth for the form editor.
 * This structure will eventually be saved to the database.
 */
interface BookingFlowData {
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
    switch (action.type) {
        case 'UPDATE_FORM_SETTINGS':
            return {
                ...state,
                ...action.payload
            };
        case 'UPDATE_NODE':
            return {
                ...state,
                serviceTree: updateNodeInTree(state.serviceTree, action.payload.nodeId, action.payload.updates)
            };
        case 'ADD_NODE':
            return {
                ...state,
                serviceTree: addNodeToTree(state.serviceTree, action.payload.parentId, action.payload.node)
            };
        case 'REORDER_NODES':
            return {
                ...state,
                serviceTree: reorderNodesInTree(state.serviceTree, action.payload.parentId, action.payload.newOrder)
            };
        case 'UPDATE_BASE_QUESTIONS':
            return {
                ...state,
                baseQuestions: action.payload
            };
        case 'INITIALIZE_DATA':
            return action.payload;
        case 'REMOVE_NODE':
            return {
                ...state,
                serviceTree: removeNodeFromTree(state.serviceTree, action.payload.nodeId)
            };
        default:
            return state;
    }
}

/**
 * Helper function to recursively update a node in the tree.
 * Traverses the tree to find the target node and applies updates immutably.
 */
function updateNodeInTree(tree: FlowNode, nodeId: string, updates: Partial<FlowNode>): FlowNode {
    if (tree.id === nodeId) {
        return { ...tree, ...updates };
    }

    if (tree.children) {
        return {
            ...tree,
            children: tree.children.map(child => updateNodeInTree(child, nodeId, updates))
        };
    }

    return tree;
}

/**
 * Helper function to add a new node to the tree.
 * Finds the parent node and appends the new node to its children.
 */
function addNodeToTree(tree: FlowNode, parentId: string, newNode: FlowNode): FlowNode {
    if (tree.id === parentId) {
        return {
            ...tree,
            children: [...(tree.children || []), newNode]
        };
    }

    if (tree.children) {
        return {
            ...tree,
            children: tree.children.map(child => addNodeToTree(child, parentId, newNode))
        };
    }

    return tree;
}

/**
 * Helper function to reorder nodes within a parent node.
 * Replaces the children array with the newly ordered array.
 */
function reorderNodesInTree(tree: FlowNode, parentId: string, newOrder: FlowNode[]): FlowNode {
    if (tree.id === parentId) {
        return {
            ...tree,
            children: newOrder
        };
    }

    if (tree.children) {
        return {
            ...tree,
            children: tree.children.map(child => reorderNodesInTree(child, parentId, newOrder))
        };
    }

    return tree;
}

/**
 * Helper function to remove a node from the tree.
 * Filters out the target node and recursively processes children.
 */
function removeNodeFromTree(tree: FlowNode, nodeId: string): FlowNode {
    if (tree.children) {
        return {
            ...tree,
            children: tree.children
                .filter(child => child.id !== nodeId)
                .map(child => removeNodeFromTree(child, nodeId))
        };
    }

    return tree;
}

/**
 * Context to provide form data and dispatch function throughout the component tree.
 * Uses undefined as initial value to enforce provider wrapping.
 * Now includes auto-save state passed from parent.
 */
const FormEditorDataContext = createContext<{
    data: BookingFlowData;
    dispatch: React.Dispatch<FormEditorDataAction>;
    // Auto-save state from parent
    isSaving: boolean;
    lastSaved: Date | null;
    isDirty: boolean;
    errors: string[];
    saveNow: () => Promise<void>;
} | undefined>(undefined);

/**
 * Provider component that makes the form data and dispatch function available
 * to any nested components that call the useFormEditorData hook.
 * Now receives data and dispatch directly from parent (no local state).
 */
export const FormEditorDataProvider: React.FC<{
    children: ReactNode;
    data: BookingFlowData;
    dispatch: React.Dispatch<FormEditorDataAction>;
    formId: string;
    isSaving?: boolean;
    lastSaved?: Date | null;
    isDirty?: boolean;
    errors?: string[];
    saveNow?: () => Promise<void>;
}> = ({ 
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
    const contextValue = {
        data,
        dispatch,
        isSaving,
        lastSaved,
        isDirty,
        errors,
        saveNow
    };

    return (
        <FormErrorBoundary 
            onError={(error) => {
                console.error('Form editor error:', error);
                // Could add additional error reporting here
            }}
            showToast={true}
        >
            <FormEditorDataContext.Provider value={contextValue}>
                {children}
            </FormEditorDataContext.Provider>
        </FormErrorBoundary>
    );
};

/**
 * Custom hook to access the form data context.
 * Throws an error if used outside of the FormEditorDataProvider.
 * Now includes auto-save state and functionality.
 */
export const useFormEditorData = () => {
    const context = useContext(FormEditorDataContext);
    if (!context) {
        throw new Error('useFormEditorData must be used within a FormEditorDataProvider');
    }
    return context;
};