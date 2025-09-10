import { FlowNode, NodeType } from '../form-flow-tree';

/**
 * Centralized utilities for operating on FlowNode trees.
 * This eliminates duplicate implementations across components.
 */
export const nodeOps = {
  /**
   * Find a node by ID in the tree
   */
  findById(tree: FlowNode, id: string): FlowNode | null {
    if (tree.id === id) return tree;

    if (tree.children) {
      for (const child of tree.children) {
        const found = this.findById(child, id);
        if (found) return found;
      }
    }

    return null;
  },

  /**
   * Find the parent of a node by child ID
   */
  findParent(tree: FlowNode, childId: string): FlowNode | null {
    if (tree.children) {
      for (const child of tree.children) {
        if (child.id === childId) {
          return tree;
        }
        
        const found = this.findParent(child, childId);
        if (found) return found;
      }
    }

    return null;
  },

  /**
   * Update a node in the tree immutably
   */
  updateNode(tree: FlowNode, nodeId: string, updates: Partial<FlowNode>): FlowNode {
    if (tree.id === nodeId) {
      return { ...tree, ...updates };
    }

    if (tree.children) {
      return {
        ...tree,
        children: tree.children.map(child => this.updateNode(child, nodeId, updates))
      };
    }

    return tree;
  },

  /**
   * Add a child node to a parent node
   */
  addChild(tree: FlowNode, parentId: string, newChild: FlowNode): FlowNode {
    if (tree.id === parentId) {
      return {
        ...tree,
        children: [...(tree.children || []), newChild]
      };
    }

    if (tree.children) {
      return {
        ...tree,
        children: tree.children.map(child => this.addChild(child, parentId, newChild))
      };
    }

    return tree;
  },

  /**
   * Remove a node from the tree
   */
  removeNode(tree: FlowNode, nodeId: string): FlowNode {
    if (tree.children) {
      return {
        ...tree,
        children: tree.children
          .filter(child => child.id !== nodeId)
          .map(child => this.removeNode(child, nodeId))
      };
    }

    return tree;
  },

  /**
   * Reorder nodes within a parent
   */
  reorderNodes(tree: FlowNode, parentId: string, newOrder: FlowNode[]): FlowNode {
    if (tree.id === parentId) {
      return {
        ...tree,
        children: newOrder
      };
    }

    if (tree.children) {
      return {
        ...tree,
        children: tree.children.map(child => this.reorderNodes(child, parentId, newOrder))
      };
    }

    return tree;
  },

  /**
   * Get the path to a node (array of node labels)
   */
  getPath(tree: FlowNode, nodeId: string, currentPath: string[] = []): string[] | null {
    const newPath = [...currentPath, tree.label];
    
    if (tree.id === nodeId) {
      return newPath;
    }

    if (tree.children) {
      for (const child of tree.children) {
        const found = this.getPath(child, nodeId, newPath);
        if (found) return found;
      }
    }

    return null;
  },

  /**
   * Get all nodes in the tree as a flat array
   */
  getAllNodes(tree: FlowNode): FlowNode[] {
    const nodes = [tree];
    
    if (tree.children) {
      for (const child of tree.children) {
        nodes.push(...this.getAllNodes(child));
      }
    }

    return nodes;
  },

  /**
   * Get all nodes of a specific type
   */
  getNodesByType(tree: FlowNode, type: NodeType): FlowNode[] {
    const allNodes = this.getAllNodes(tree);
    return allNodes.filter(node => node.type === type);
  },

  /**
   * Check if a node exists in the tree
   */
  nodeExists(tree: FlowNode, nodeId: string): boolean {
    return this.findById(tree, nodeId) !== null;
  },

  /**
   * Get depth of a node in the tree
   */
  getNodeDepth(tree: FlowNode, nodeId: string, currentDepth: number = 0): number | null {
    if (tree.id === nodeId) {
      return currentDepth;
    }

    if (tree.children) {
      for (const child of tree.children) {
        const depth = this.getNodeDepth(child, nodeId, currentDepth + 1);
        if (depth !== null) return depth;
      }
    }

    return null;
  },

  /**
   * Get all leaf nodes (nodes without children)
   */
  getLeafNodes(tree: FlowNode): FlowNode[] {
    if (!tree.children || tree.children.length === 0) {
      return [tree];
    }

    const leafNodes: FlowNode[] = [];
    for (const child of tree.children) {
      leafNodes.push(...this.getLeafNodes(child));
    }

    return leafNodes;
  },

  /**
   * Move a node to a different parent
   */
  moveNode(tree: FlowNode, nodeId: string, newParentId: string): FlowNode {
    const nodeToMove = this.findById(tree, nodeId);
    if (!nodeToMove) return tree;

    // First remove the node
    const treeWithoutNode = this.removeNode(tree, nodeId);
    
    // Then add it to the new parent
    return this.addChild(treeWithoutNode, newParentId, nodeToMove);
  },

  /**
   * Validate tree structure
   */
  validateTree(tree: FlowNode): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    const validateNode = (node: FlowNode, path: string[] = []) => {
      const currentPath = [...path, node.label];
      
      // Check for duplicate IDs
      if (seenIds.has(node.id)) {
        errors.push(`Duplicate ID found: ${node.id} at ${currentPath.join(' > ')}`);
      } else {
        seenIds.add(node.id);
      }

      // Check required fields
      if (!node.id) {
        errors.push(`Missing ID at ${currentPath.join(' > ')}`);
      }
      if (!node.label) {
        errors.push(`Missing label at ${currentPath.join(' > ')}`);
      }
      if (!node.type) {
        errors.push(`Missing type at ${currentPath.join(' > ')}`);
      }

      // Recursively validate children
      if (node.children) {
        for (const child of node.children) {
          validateNode(child, currentPath);
        }
      }
    };

    validateNode(tree);

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Clone a tree deeply
   */
  cloneTree(tree: FlowNode): FlowNode {
    return {
      ...tree,
      children: tree.children?.map(child => this.cloneTree(child))
    };
  }
};

// Type-safe wrapper functions for common operations
export const findNodeById = (tree: FlowNode, id: string) => nodeOps.findById(tree, id);
export const updateNodeInTree = (tree: FlowNode, nodeId: string, updates: Partial<FlowNode>) => 
  nodeOps.updateNode(tree, nodeId, updates);
export const addNodeToTree = (tree: FlowNode, parentId: string, newNode: FlowNode) => 
  nodeOps.addChild(tree, parentId, newNode);
export const removeNodeFromTree = (tree: FlowNode, nodeId: string) => 
  nodeOps.removeNode(tree, nodeId);
export const reorderNodesInTree = (tree: FlowNode, parentId: string, newOrder: FlowNode[]) => 
  nodeOps.reorderNodes(tree, parentId, newOrder);