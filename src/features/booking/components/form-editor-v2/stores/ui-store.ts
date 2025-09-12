import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ViewType, NavigationState } from '../core/models/types';

interface UIStore {
  // Navigation state
  selectedNodeId: string | null;
  currentView: ViewType;
  expandedNodes: Set<string>;
  breadcrumb: Array<{ id: string; label: string }>;
  
  // UI state
  isDragging: boolean;
  draggedNodeId: string | null;
  
  // Panel state
  leftPanelWidth: number;
  rightPanelWidth: number;
  showPreview: boolean;
  
  // Dialog state
  openDialogs: Set<string>;
  
  // Actions
  selectNode: (id: string | null) => void;
  setView: (view: ViewType) => void;
  toggleNodeExpansion: (id: string) => void;
  expandNode: (id: string) => void;
  collapseNode: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  
  setBreadcrumb: (breadcrumb: Array<{ id: string; label: string }>) => void;
  
  setDragging: (isDragging: boolean, nodeId?: string) => void;
  
  setPanelWidth: (panel: 'left' | 'right', width: number) => void;
  togglePreview: () => void;
  
  openDialog: (dialogId: string) => void;
  closeDialog: (dialogId: string) => void;
  isDialogOpen: (dialogId: string) => boolean;
  
  // Computed getters
  getNavigationState: () => NavigationState;
}

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      selectedNodeId: null,
      currentView: 'tree',
      expandedNodes: new Set(['root']),
      breadcrumb: [],
      
      isDragging: false,
      draggedNodeId: null,
      
      leftPanelWidth: 320,
      rightPanelWidth: 384,
      showPreview: true,
      
      openDialogs: new Set(),
      
      // Navigation actions
      selectNode: (id) => set((state) => ({
        selectedNodeId: id,
        currentView: id ? 'editor' : 'tree'
      })),
      
      setView: (view) => set(() => ({ currentView: view })),
      
      toggleNodeExpansion: (id) => set((state) => {
        const expanded = new Set(state.expandedNodes);
        if (expanded.has(id)) {
          expanded.delete(id);
        } else {
          expanded.add(id);
        }
        return { expandedNodes: expanded };
      }),
      
      expandNode: (id) => set((state) => {
        const expanded = new Set(state.expandedNodes);
        expanded.add(id);
        return { expandedNodes: expanded };
      }),
      
      collapseNode: (id) => set((state) => {
        const expanded = new Set(state.expandedNodes);
        expanded.delete(id);
        return { expandedNodes: expanded };
      }),
      
      expandAll: () => set((state) => {
        // This would need access to the form store to get all node IDs
        // For now, just expand common nodes
        return { expandedNodes: new Set(['root']) };
      }),
      
      collapseAll: () => set(() => ({ expandedNodes: new Set(['root']) })),
      
      setBreadcrumb: (breadcrumb) => set(() => ({ breadcrumb })),
      
      // Drag state actions
      setDragging: (isDragging, nodeId) => set(() => ({
        isDragging,
        draggedNodeId: isDragging ? nodeId || null : null
      })),
      
      // Panel actions
      setPanelWidth: (panel, width) => set((state) => {
        const updates: Partial<UIStore> = {};
        if (panel === 'left') {
          updates.leftPanelWidth = Math.max(200, Math.min(600, width));
        } else {
          updates.rightPanelWidth = Math.max(300, Math.min(800, width));
        }
        return updates;
      }),
      
      togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),
      
      // Dialog actions
      openDialog: (dialogId) => set((state) => {
        const dialogs = new Set(state.openDialogs);
        dialogs.add(dialogId);
        return { openDialogs: dialogs };
      }),
      
      closeDialog: (dialogId) => set((state) => {
        const dialogs = new Set(state.openDialogs);
        dialogs.delete(dialogId);
        return { openDialogs: dialogs };
      }),
      
      isDialogOpen: (dialogId) => {
        const state = get();
        return state.openDialogs.has(dialogId);
      },
      
      // Computed getters
      getNavigationState: () => {
        const state = get();
        return {
          selectedNodeId: state.selectedNodeId,
          currentView: state.currentView,
          breadcrumb: state.breadcrumb
        };
      }
    }),
    { name: 'ui-store' }
  )
);