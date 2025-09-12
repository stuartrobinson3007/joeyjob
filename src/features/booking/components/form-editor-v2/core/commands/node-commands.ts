import { BaseCommand } from './base';
import { Node } from '../models/types';
import { useFormStore } from '../../stores/form-store';

/**
 * Command to add a new node
 */
export class AddNodeCommand extends BaseCommand {
  public readonly description: string;
  private nodeId?: string;

  constructor(
    private parentId: string,
    private nodeData: Omit<Node, 'id' | 'parentId'>,
    description?: string
  ) {
    super();
    this.description = description || `Add ${nodeData.type} node`;
  }

  execute(): void {
    const store = useFormStore.getState();
    this.nodeId = store.addNode(this.parentId, this.nodeData);
  }

  undo(): void {
    if (this.nodeId) {
      const store = useFormStore.getState();
      store.deleteNode(this.nodeId);
    }
  }

  canExecute(): boolean {
    const store = useFormStore.getState();
    const parent = store.nodes[this.parentId];
    return !!parent && ('childIds' in parent);
  }
}

/**
 * Command to delete a node
 */
export class DeleteNodeCommand extends BaseCommand {
  public readonly description: string;
  private deletedNode?: Node;
  private deletedChildren?: Record<string, Node>;
  private deletedQuestions?: Record<string, any>;

  constructor(private nodeId: string, description?: string) {
    super();
    this.description = description || `Delete node`;
  }

  execute(): void {
    const store = useFormStore.getState();
    const node = store.nodes[this.nodeId];
    
    if (!node) return;

    // Store deleted data for undo
    this.deletedNode = { ...node };
    this.deletedChildren = {};
    this.deletedQuestions = {};

    // Collect all descendant nodes and questions
    const collectDescendants = (nodeId: string) => {
      const n = store.nodes[nodeId];
      if (!n) return;
      
      this.deletedChildren![nodeId] = { ...n };
      
      if (n.type === 'service') {
        n.questionIds.forEach(qId => {
          const question = store.questions[qId];
          if (question) {
            this.deletedQuestions![qId] = { ...question };
          }
        });
      }
      
      if ('childIds' in n) {
        n.childIds.forEach(collectDescendants);
      }
    };

    if ('childIds' in node) {
      node.childIds.forEach(collectDescendants);
    }

    // Execute deletion
    store.deleteNode(this.nodeId);
  }

  undo(): void {
    if (!this.deletedNode) return;

    const store = useFormStore.getState();
    
    // Restore questions first
    Object.entries(this.deletedQuestions || {}).forEach(([id, question]) => {
      store.questions[id] = question;
    });
    
    // Restore nodes
    store.nodes[this.nodeId] = this.deletedNode;
    Object.entries(this.deletedChildren || {}).forEach(([id, node]) => {
      store.nodes[id] = node;
    });
    
    // Restore parent relationship
    if (this.deletedNode.parentId) {
      const parent = store.nodes[this.deletedNode.parentId];
      if (parent && 'childIds' in parent) {
        if (!parent.childIds.includes(this.nodeId)) {
          parent.childIds.push(this.nodeId);
        }
      }
    }

    store.setDirty(true);
  }

  canExecute(): boolean {
    const store = useFormStore.getState();
    return !!store.nodes[this.nodeId];
  }
}

/**
 * Command to update a node
 */
export class UpdateNodeCommand extends BaseCommand {
  public readonly description: string;
  private previousData?: Partial<Node>;

  constructor(
    private nodeId: string,
    private updates: Partial<Node>,
    description?: string
  ) {
    super();
    this.description = description || `Update node`;
  }

  execute(): void {
    const store = useFormStore.getState();
    const node = store.nodes[this.nodeId];
    
    if (!node) return;

    // Store previous data for undo
    this.previousData = {};
    Object.keys(this.updates).forEach(key => {
      (this.previousData as any)[key] = (node as any)[key];
    });

    store.updateNode(this.nodeId, this.updates);
  }

  undo(): void {
    if (this.previousData) {
      const store = useFormStore.getState();
      store.updateNode(this.nodeId, this.previousData);
    }
  }

  canExecute(): boolean {
    const store = useFormStore.getState();
    return !!store.nodes[this.nodeId];
  }
}

/**
 * Command to move a node
 */
export class MoveNodeCommand extends BaseCommand {
  public readonly description: string;
  private previousParentId?: string | null;
  private previousIndex?: number;

  constructor(
    private nodeId: string,
    private newParentId: string,
    private newIndex?: number,
    description?: string
  ) {
    super();
    this.description = description || `Move node`;
  }

  execute(): void {
    const store = useFormStore.getState();
    const node = store.nodes[this.nodeId];
    
    if (!node) return;

    // Store previous state for undo
    this.previousParentId = node.parentId;
    
    if (this.previousParentId) {
      const previousParent = store.nodes[this.previousParentId];
      if (previousParent && 'childIds' in previousParent) {
        this.previousIndex = previousParent.childIds.indexOf(this.nodeId);
      }
    }

    store.moveNode(this.nodeId, this.newParentId, this.newIndex);
  }

  undo(): void {
    if (this.previousParentId !== undefined) {
      const store = useFormStore.getState();
      store.moveNode(this.nodeId, this.previousParentId!, this.previousIndex);
    }
  }

  canExecute(): boolean {
    const store = useFormStore.getState();
    const node = store.nodes[this.nodeId];
    const newParent = store.nodes[this.newParentId];
    
    return !!node && !!newParent && ('childIds' in newParent) && this.nodeId !== this.newParentId;
  }
}