import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList } from 'react-window';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal } from 'lucide-react';

import { Button } from '@/taali/components/ui/button';
import { cn } from '@/taali/lib/utils';
import { TreeNode } from '../../core/models/types';

interface FlatNode extends TreeNode {
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
  parentId?: string;
}

interface VirtualTreeProps {
  tree: TreeNode | null;
  height?: number;
  itemHeight?: number;
  selectedId?: string | null;
  expandedNodes?: Set<string>;
  onSelect?: (id: string) => void;
  onToggleExpand?: (id: string) => void;
  onAddService?: (parentId: string) => void;
  onAddGroup?: (parentId: string) => void;
  onDelete?: (id: string) => void;
}

const ITEM_HEIGHT = 36;

export function VirtualTree({
  tree,
  height = 600,
  itemHeight = ITEM_HEIGHT,
  selectedId,
  expandedNodes = new Set(),
  onSelect,
  onToggleExpand,
  onAddService,
  onAddGroup,
  onDelete
}: VirtualTreeProps) {
  const listRef = useRef<FixedSizeList>(null);
  
  // Flatten the tree structure for virtual scrolling
  const flattenedNodes = useMemo(() => {
    if (!tree) return [];
    
    const flatten = (node: TreeNode, level = 0): FlatNode[] => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      
      const flatNode: FlatNode = {
        ...node,
        level,
        hasChildren,
        isExpanded
      };
      
      const result = [flatNode];
      
      if (hasChildren && isExpanded) {
        node.children!.forEach(child => {
          result.push(...flatten(child, level + 1));
        });
      }
      
      return result;
    };
    
    return flatten(tree);
  }, [tree, expandedNodes]);

  // Scroll to selected item
  useEffect(() => {
    if (selectedId && listRef.current) {
      const index = flattenedNodes.findIndex(node => node.id === selectedId);
      if (index !== -1) {
        listRef.current.scrollToItem(index, 'center');
      }
    }
  }, [selectedId, flattenedNodes]);

  const TreeNodeItem = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const node = flattenedNodes[index];
    if (!node) return null;

    const isSelected = node.id === selectedId;
    const canHaveChildren = node.type === 'root' || node.type === 'group';

    const handleToggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggleExpand) {
        onToggleExpand(node.id);
      }
    };

    const handleSelect = () => {
      if (onSelect) {
        onSelect(node.id);
      }
    };

    const getNodeIcon = () => {
      switch (node.type) {
        case 'root':
          return '🏠';
        case 'service':
          return '⚙️';
        case 'group':
          return '📁';
        default:
          return '❓';
      }
    };

    return (
      <div style={style}>
        <div
          className={cn(
            "flex items-center gap-2 p-2 mx-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50",
            isSelected && "bg-primary/10 border border-primary/20"
          )}
          style={{ marginLeft: node.level * 16 }}
          onClick={handleSelect}
        >
          {/* Expand/collapse button */}
          {node.hasChildren && (
            <button
              onClick={handleToggleExpand}
              className="w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded"
            >
              {node.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}

          {/* Empty space if no children */}
          {!node.hasChildren && <div className="w-4" />}

          {/* Icon */}
          <span className="text-sm">{getNodeIcon()}</span>

          {/* Label */}
          <span className="flex-1 text-sm font-medium truncate">
            {node.label}
          </span>

          {/* Actions - only show on hover or selection */}
          {(isSelected || node.type === 'root') && (
            <div className="flex items-center gap-1">
              {canHaveChildren && onAddService && onAddGroup && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddService(node.id);
                    }}
                    title="Add Service"
                  >
                    <Plus size={12} />
                  </Button>
                </>
              )}

              {node.type !== 'root' && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-0 text-red-500 hover:text-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(node.id);
                  }}
                  title="Delete"
                >
                  <MoreHorizontal size={12} />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, [flattenedNodes, selectedId, onSelect, onToggleExpand, onAddService, onAddGroup, onDelete]);

  if (!tree || flattenedNodes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No form data available
      </div>
    );
  }

  return (
    <FixedSizeList
      ref={listRef}
      height={height}
      itemCount={flattenedNodes.length}
      itemSize={itemHeight}
      itemData={flattenedNodes}
    >
      {TreeNodeItem}
    </FixedSizeList>
  );
}