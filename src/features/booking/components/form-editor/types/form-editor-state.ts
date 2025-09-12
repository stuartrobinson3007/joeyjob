import { FormFieldConfig } from '@/features/booking/lib/form-field-types';
import { FlowNode } from '../form-flow-tree';

/**
 * Enhanced form editor state that properly handles loading states
 */
export interface BookingFlowData {
  id: string;
  internalName: string;
  slug: string;
  serviceTree: FlowNode;
  baseQuestions: FormFieldConfig[];
  theme: 'light' | 'dark';
  primaryColor: string;
}

/**
 * Form editor state with proper loading/error handling
 */
export interface FormEditorState {
  status: 'loading' | 'loaded' | 'error';
  data: BookingFlowData | null;
  error?: string;
}

/**
 * Actions for the enhanced form editor state management
 */
export type FormEditorStateAction =
  | { type: 'FORM_LOADED'; payload: BookingFlowData }
  | { type: 'FORM_LOAD_ERROR'; payload: string }
  | { type: 'FORM_DATA_UPDATED'; payload: FormEditorDataAction }
  | { type: 'RESET_TO_LOADING' };

/**
 * Actions for modifying form data (nested within FORM_DATA_UPDATED)
 */
export type FormEditorDataAction =
  | { type: 'UPDATE_FORM_SETTINGS'; payload: { internalName?: string; slug?: string; theme?: 'light' | 'dark'; primaryColor?: string } }
  | { type: 'UPDATE_NODE'; payload: { nodeId: string; updates: Partial<FlowNode> } }
  | { type: 'ADD_NODE'; payload: { parentId: string; node: FlowNode } }
  | { type: 'REORDER_NODES'; payload: { parentId: string; newOrder: FlowNode[] } }
  | { type: 'UPDATE_BASE_QUESTIONS'; payload: FormFieldConfig[] }
  | { type: 'REMOVE_NODE'; payload: { nodeId: string } };

/**
 * Initial loading state
 */
export const initialFormEditorState: FormEditorState = {
  status: 'loading',
  data: null,
  error: undefined
};

/**
 * Create default form data
 */
export function createDefaultFormData(formId: string): BookingFlowData {
  return {
    id: formId,
    internalName: '',
    slug: '',
    serviceTree: {
      id: 'root',
      type: 'start',
      label: 'Book your service',
      children: []
    },
    baseQuestions: [],
    theme: 'light',
    primaryColor: '#3B82F6'
  };
}