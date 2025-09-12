import { 
  FormEditorState, 
  FormEditorStateAction, 
  FormEditorDataAction,
  BookingFlowData 
} from '../types/form-editor-state';
import { 
  updateNodeInTree, 
  addNodeToTree, 
  removeNodeFromTree, 
  reorderNodesInTree 
} from '../utils/node-operations';

/**
 * Enhanced form editor state reducer that properly handles loading states.
 * This replaces the problematic direct useReducer initialization with async data.
 */
export function formEditorStateReducer(
  state: FormEditorState, 
  action: FormEditorStateAction
): FormEditorState {
  console.log('🔧 [FormEditorStateReducer] Processing action:', {
    type: action.type,
    currentStatus: state.status,
    hasData: !!state.data,
    payload: action.type.includes('FORM_DATA_UPDATED') ? 'FormDataAction' : action.payload
  });

  switch (action.type) {
    case 'FORM_LOADED':
      const newState = {
        status: 'loaded' as const,
        data: action.payload,
        error: undefined
      };
      console.log('🔧 [FormEditorStateReducer] Form loaded:', {
        formId: action.payload.id,
        internalName: action.payload.internalName,
        slug: action.payload.slug,
        serviceTreeChildren: action.payload.serviceTree?.children?.length || 0
      });
      return newState;

    case 'FORM_LOAD_ERROR':
      console.log('🔧 [FormEditorStateReducer] Form load error:', action.payload);
      return {
        status: 'error',
        data: null,
        error: action.payload
      };

    case 'RESET_TO_LOADING':
      console.log('🔧 [FormEditorStateReducer] Resetting to loading state');
      return {
        status: 'loading',
        data: null,
        error: undefined
      };

    case 'FORM_DATA_UPDATED':
      // Only process data updates if we're in loaded state
      if (state.status !== 'loaded' || !state.data) {
        console.warn('🔧 [FormEditorStateReducer] Attempted to update data in non-loaded state:', state.status);
        return state;
      }

      const updatedData = formDataReducer(state.data, action.payload);
      const resultState = {
        ...state,
        data: updatedData
      };

      console.log('🔧 [FormEditorStateReducer] Data updated:', {
        dataChanged: updatedData !== state.data,
        actionType: action.payload.type,
        newInternalName: updatedData.internalName,
        newServiceTreeChildren: updatedData.serviceTree?.children?.length || 0
      });

      return resultState;

    default:
      console.warn('🔧 [FormEditorStateReducer] Unknown action type:', (action as any).type);
      return state;
  }
}

/**
 * Nested reducer for handling form data changes.
 * This is the same logic as the original formEditorDataReducer but extracted.
 */
function formDataReducer(
  state: BookingFlowData, 
  action: FormEditorDataAction
): BookingFlowData {
  console.log('🔧 [FormDataReducer] Processing nested action:', {
    type: action.type,
    payload: action.payload
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

    case 'REMOVE_NODE':
      newState = {
        ...state,
        serviceTree: removeNodeFromTree(state.serviceTree, action.payload.nodeId)
      };
      break;

    default:
      newState = state;
  }

  console.log('🔧 [FormDataReducer] Nested action result:', {
    type: action.type,
    stateChanged: newState !== state
  });

  return newState;
}

/**
 * Helper function to check if the form editor is ready for user interaction
 */
export function isFormEditorReady(state: FormEditorState): state is FormEditorState & { 
  status: 'loaded'; 
  data: BookingFlowData 
} {
  return state.status === 'loaded' && state.data !== null;
}

/**
 * Helper function to safely get form data (returns null if not loaded)
 */
export function getFormData(state: FormEditorState): BookingFlowData | null {
  return isFormEditorReady(state) ? state.data : null;
}