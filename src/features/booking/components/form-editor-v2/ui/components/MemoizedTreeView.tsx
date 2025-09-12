import React, { memo, useMemo, useCallback } from 'react';

import { useFormStore } from '../../stores/form-store';
import { useUIStore } from '../../stores/ui-store';
import { useCommands } from '../../hooks/use-commands';
import { usePerformance } from '../../hooks/use-performance';
import { AddNodeCommand, DeleteNodeCommand } from '../../core/commands/node-commands';
import { TreeNode } from '../../core/models/types';
import { TreeView } from '../views/TreeView';
import { VirtualTree } from './VirtualTree';

interface MemoizedTreeViewProps {
  useVirtualScrolling?: boolean;
  height?: number;
}

// Memoize the tree structure calculation
const useOptimizedTree = () => {
  const tree = useFormStore(useCallback(state => state.getTree(), []));
  
  return useMemo(() => {
    if (!tree) return null;
    
    // Pre-calculate expensive tree operations
    const nodeCount = countNodes(tree);
    const maxDepth = calculateMaxDepth(tree);
    
    return {
      tree,
      nodeCount,
      maxDepth
    };
  }, [tree]);
};

// Helper functions that can be memoized
const countNodes = (node: TreeNode): number => {
  let count = 1;
  if (node.children) {
    count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
  }
  return count;
};

const calculateMaxDepth = (node: TreeNode, depth = 0): number => {
  if (!node.children || node.children.length === 0) {
    return depth;
  }
  return Math.max(...node.children.map(child => calculateMaxDepth(child, depth + 1)));
};

// Memoized tree node actions
const useTreeActions = () => {
  const { execute } = useCommands();
  const { startTimer, endTimer } = usePerformance();
  
  const handleAddService = useCallback((parentId: string) => {
    startTimer('update');
    const command = new AddNodeCommand(parentId, {
      type: 'service',
      serviceId: `service-${Date.now()}`,
      label: 'New Service',
      questionIds: []
    } as any, 'Add new service');
    execute(command).finally(() => endTimer('update'));
  }, [execute, startTimer, endTimer]);

  const handleAddGroup = useCallback((parentId: string) => {
    startTimer('update');
    const command = new AddNodeCommand(parentId, {
      type: 'group',
      label: 'New Group',
      childIds: []
    } as any, 'Add new group');
    execute(command).finally(() => endTimer('update'));
  }, [execute, startTimer, endTimer]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    startTimer('update');
    const command = new DeleteNodeCommand(nodeId, 'Delete node');
    execute(command).finally(() => endTimer('update'));
  }, [execute, startTimer, endTimer]);

  return {
    handleAddService,
    handleAddGroup,
    handleDeleteNode
  };
};

// Memoized UI state selectors
const useTreeUIState = () => {
  const selectedNodeId = useUIStore(useCallback(state => state.selectedNodeId, []));
  const expandedNodes = useUIStore(useCallback(state => state.expandedNodes, []));
  const selectNode = useUIStore(useCallback(state => state.selectNode, []));
  const toggleNodeExpansion = useUIStore(useCallback(state => state.toggleNodeExpansion, []));
  
  return {
    selectedNodeId,
    expandedNodes,
    selectNode,
    toggleNodeExpansion
  };
};

// Main memoized tree view component
export const MemoizedTreeView = memo<MemoizedTreeViewProps>(function MemoizedTreeView({
  useVirtualScrolling = true,
  height = 600
}) {
  const treeData = useOptimizedTree();
  const treeActions = useTreeActions();
  const uiState = useTreeUIState();
  const { measureRender } = usePerformance();

  // Determine whether to use virtual scrolling based on node count
  const shouldUseVirtual = useVirtualScrolling && treeData && treeData.nodeCount > 50;

  // Memoize the tree component props to prevent unnecessary re-renders
  const treeProps = useMemo(() => ({
    tree: treeData?.tree || null,
    selectedId: uiState.selectedNodeId,
    expandedNodes: uiState.expandedNodes,
    onSelect: uiState.selectNode,
    onToggleExpand: uiState.toggleNodeExpansion,
    onAddService: treeActions.handleAddService,
    onAddGroup: treeActions.handleAddGroup,
    onDelete: treeActions.handleDeleteNode
  }), [treeData?.tree, uiState, treeActions]);

  if (!treeData) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading form data...
      </div>
    );
  }

  // Performance monitoring wrapper
  const renderTree = () => {
    if (shouldUseVirtual) {
      return (
        <VirtualTree
          {...treeProps}
          height={height}
        />
      );
    }
    
    return <TreeView />;
  };

  return measureRender(renderTree);
});

// Additional performance optimizations

// Memoized tree statistics component
export const TreeStats = memo(function TreeStats() {
  const treeData = useOptimizedTree();
  
  if (!treeData) return null;
  
  return (
    <div className="text-xs text-gray-500 p-2 border-t">
      <div>Nodes: {treeData.nodeCount}</div>
      <div>Max Depth: {treeData.maxDepth}</div>
    </div>
  );
});

// Optimized search/filter functionality
export const useTreeSearch = () => {
  const treeData = useOptimizedTree();
  
  const searchNodes = useCallback((query: string) => {
    if (!treeData?.tree || !query.trim()) return [];
    
    const results: TreeNode[] = [];
    const searchRecursive = (node: TreeNode) => {
      if (node.label.toLowerCase().includes(query.toLowerCase())) {
        results.push(node);
      }
      if (node.children) {
        node.children.forEach(searchRecursive);
      }
    };
    
    searchRecursive(treeData.tree);
    return results;
  }, [treeData?.tree]);
  
  return { searchNodes };
};

// Performance wrapper for heavy operations
export const withTreePerformance = <P extends object>(
  WrappedComponent: React.ComponentType<P>
) => {
  return memo(function PerformanceWrapper(props: P) {
    const { logMetrics } = usePerformance();
    
    React.useEffect(() => {
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        const timeout = setTimeout(logMetrics, 1000);
        return () => clearTimeout(timeout);
      }
    }, [logMetrics]);
    
    return React.createElement(WrappedComponent, props);
  });
};