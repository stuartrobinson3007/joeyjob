import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import { Node, Question, FormState, TreeNode, NodeWithDetails, ServiceNode, GroupNode } from '../core/models/types';
import { FormFieldConfig } from '@/features/booking/lib/form-field-types';

interface FormStore extends FormState {
  // Actions
  updateForm: (updates: Partial<Pick<FormState, 'name' | 'slug' | 'theme' | 'primaryColor'>>) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  addNode: (parentId: string, node: Omit<Node, 'id' | 'parentId'>) => string;
  deleteNode: (id: string) => void;
  moveNode: (nodeId: string, newParentId: string, index?: number) => void;
  
  addQuestion: (serviceId: string, config: FormFieldConfig) => string;
  updateQuestion: (id: string, config: FormFieldConfig) => void;
  deleteQuestion: (id: string) => void;
  reorderQuestions: (serviceId: string, questionIds: string[]) => void;
  
  updateBaseQuestions: (questions: FormFieldConfig[]) => void;
  
  // Computed selectors
  getTree: () => TreeNode | null;
  getNodeWithDetails: (id: string) => NodeWithDetails | null;
  getServiceQuestions: (serviceId: string) => Question[];
  
  // State management
  setDirty: (dirty: boolean) => void;
  markSaved: () => void;
  reset: (data: FormState) => void;
}

export const useFormStore = create<FormStore>()(
  devtools(
    immer((set, get) => ({
        // Initial state
        id: '',
        name: '',
        slug: '',
        theme: 'light',
        primaryColor: '#3B82F6',
        nodes: {},
        questions: {},
        baseQuestions: [],
        rootId: 'root',
        lastSaved: undefined,
        isDirty: false,
        
        // Form-level actions
        updateForm: (updates) => set((state) => {
          Object.assign(state, updates);
          state.isDirty = true;
        }),
        
        // Node actions with Immer for immutability
        updateNode: (id, updates) => set((state) => {
          const node = state.nodes[id];
          if (!node) return;
          
          Object.assign(state.nodes[id], updates);
          state.isDirty = true;
        }),
        
        addNode: (parentId, nodeData) => {
          const id = nanoid();
          
          set((state) => {
            // Create the new node with proper parentId
            const node: Node = {
              ...nodeData,
              id,
              parentId
            } as Node;
            
            state.nodes[id] = node;
            
            // Add to parent's children
            const parent = state.nodes[parentId];
            if (parent && ('childIds' in parent)) {
              parent.childIds.push(id);
            }
            
            state.isDirty = true;
          });
          
          return id;
        },
        
        deleteNode: (id) => set((state) => {
          const node = state.nodes[id];
          if (!node) return;
          
          // Remove from parent's children
          if (node.parentId) {
            const parent = state.nodes[node.parentId];
            if (parent && 'childIds' in parent) {
              parent.childIds = parent.childIds.filter(childId => childId !== id);
            }
          }
          
          // Recursively delete child nodes
          if ('childIds' in node) {
            const deleteRecursive = (nodeId: string) => {
              const nodeToDelete = state.nodes[nodeId];
              if (nodeToDelete && 'childIds' in nodeToDelete) {
                nodeToDelete.childIds.forEach(deleteRecursive);
              }
              delete state.nodes[nodeId];
              
              // Delete associated questions if it's a service node
              if (nodeToDelete && nodeToDelete.type === 'service') {
                nodeToDelete.questionIds.forEach(qId => {
                  delete state.questions[qId];
                });
              }
            };
            
            node.childIds.forEach(deleteRecursive);
          }
          
          // Delete the node itself
          if (node.type === 'service') {
            node.questionIds.forEach(qId => {
              delete state.questions[qId];
            });
          }
          delete state.nodes[id];
          
          state.isDirty = true;
        }),
        
        moveNode: (nodeId, newParentId, index) => set((state) => {
          const node = state.nodes[nodeId];
          const newParent = state.nodes[newParentId];
          
          if (!node || !newParent || !('childIds' in newParent)) return;
          
          // Remove from current parent
          if (node.parentId) {
            const oldParent = state.nodes[node.parentId];
            if (oldParent && 'childIds' in oldParent) {
              oldParent.childIds = oldParent.childIds.filter(id => id !== nodeId);
            }
          }
          
          // Update node's parent
          node.parentId = newParentId;
          
          // Add to new parent at specific index or end
          if (index !== undefined && index >= 0) {
            newParent.childIds.splice(index, 0, nodeId);
          } else {
            newParent.childIds.push(nodeId);
          }
          
          state.isDirty = true;
        }),
        
        // Question actions
        addQuestion: (serviceId, config) => {
          const id = nanoid();
          
          set((state) => {
            const serviceNode = state.nodes[serviceId] as ServiceNode;
            if (!serviceNode || serviceNode.type !== 'service') return;
            
            const question: Question = {
              id,
              serviceId,
              config,
              order: serviceNode.questionIds.length
            };
            
            state.questions[id] = question;
            serviceNode.questionIds.push(id);
            state.isDirty = true;
          });
          
          return id;
        },
        
        updateQuestion: (id, config) => set((state) => {
          const question = state.questions[id];
          if (!question) return;
          
          question.config = config;
          state.isDirty = true;
        }),
        
        deleteQuestion: (id) => set((state) => {
          const question = state.questions[id];
          if (!question) return;
          
          // Remove from service node
          const serviceNode = state.nodes[question.serviceId] as ServiceNode;
          if (serviceNode && serviceNode.type === 'service') {
            serviceNode.questionIds = serviceNode.questionIds.filter(qId => qId !== id);
          }
          
          delete state.questions[id];
          state.isDirty = true;
        }),
        
        reorderQuestions: (serviceId, questionIds) => set((state) => {
          const serviceNode = state.nodes[serviceId] as ServiceNode;
          if (!serviceNode || serviceNode.type !== 'service') return;
          
          serviceNode.questionIds = questionIds;
          
          // Update order in question objects
          questionIds.forEach((qId, index) => {
            const question = state.questions[qId];
            if (question) {
              question.order = index;
            }
          });
          
          state.isDirty = true;
        }),
        
        updateBaseQuestions: (questions) => set((state) => {
          state.baseQuestions = questions;
          state.isDirty = true;
        }),
        
        // Computed selectors
        getTree: () => {
          const state = get();
          
          const buildTree = (id: string): TreeNode | null => {
            const node = state.nodes[id];
            if (!node) return null;
            
            const children = 'childIds' in node 
              ? node.childIds.map(buildTree).filter(Boolean) as TreeNode[]
              : [];
            
            return {
              id: node.id,
              type: node.type,
              label: node.type === 'root' ? node.title : 
                     node.type === 'service' ? node.label :
                     node.type === 'group' ? node.label : 'Unknown',
              children,
              // Include all original properties for backward compatibility
              ...node
            };
          };
          
          return buildTree(state.rootId);
        },
        
        getNodeWithDetails: (id) => {
          const state = get();
          const node = state.nodes[id];
          if (!node) return null;
          
          const questions = node.type === 'service' 
            ? node.questionIds.map(qId => state.questions[qId]).filter(Boolean)
            : [];
            
          const parent = node.parentId ? state.nodes[node.parentId] : null;
          
          const children = 'childIds' in node
            ? node.childIds.map(cId => state.nodes[cId]).filter(Boolean)
            : [];
          
          return {
            ...node,
            questions,
            parent,
            children
          };
        },
        
        getServiceQuestions: (serviceId) => {
          const state = get();
          const serviceNode = state.nodes[serviceId] as ServiceNode;
          
          if (!serviceNode || serviceNode.type !== 'service') return [];
          
          return serviceNode.questionIds
            .map(qId => state.questions[qId])
            .filter(Boolean)
            .sort((a, b) => a.order - b.order);
        },
        
        // State management
        setDirty: (dirty) => set((state) => {
          state.isDirty = dirty;
        }),
        
        markSaved: () => set((state) => {
          state.lastSaved = new Date();
          state.isDirty = false;
        }),
        
        reset: (data) => set(() => ({
          ...data,
          isDirty: false,
          lastSaved: new Date()
        }))
      })),
    { name: 'form-store' }
  )
);