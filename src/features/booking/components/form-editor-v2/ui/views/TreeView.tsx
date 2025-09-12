import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/taali/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/taali/components/ui/dropdown-menu';
import { useFormStore } from '../../stores/form-store';
import { useUIStore } from '../../stores/ui-store';
import { useCommands } from '../../hooks/use-commands';
import { AddNodeCommand, DeleteNodeCommand, MoveNodeCommand } from '../../core/commands/node-commands';
import { Node, TreeNode } from '../../core/models/types';
import { cn } from '@/taali/lib/utils';

export function TreeView() {
  const tree = useFormStore(state => state.getTree());
  const { selectedNodeId, selectNode, expandedNodes, toggleNodeExpansion } = useUIStore();
  const { execute } = useCommands();

  const handleNodeSelect = useCallback((nodeId: string) => {
    selectNode(nodeId);
  }, [selectNode]);

  const handleAddService = useCallback((parentId: string) => {
    const command = new AddNodeCommand(parentId, {
      type: 'service',
      serviceId: `service-${Date.now()}`,
      label: 'New Service',
      questionIds: []
    } as any, 'Add new service');
    execute(command);
  }, [execute]);

  const handleAddGroup = useCallback((parentId: string) => {
    const command = new AddNodeCommand(parentId, {
      type: 'group',
      label: 'New Group',
      childIds: []
    } as any, 'Add new group');
    execute(command);
  }, [execute]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    const command = new DeleteNodeCommand(nodeId, 'Delete node');
    execute(command);
  }, [execute]);

  if (!tree) {
    return (
      <div className="p-4 text-center text-gray-500">
        No form data available
      </div>
    );
  }

  return (
    <div className="p-4">
      <TreeNode
        node={tree}
        selectedId={selectedNodeId}
        expandedNodes={expandedNodes}
        onSelect={handleNodeSelect}
        onToggleExpand={toggleNodeExpansion}
        onAddService={handleAddService}
        onAddGroup={handleAddGroup}
        onDelete={handleDeleteNode}
        level={0}
      />
    </div>
  );
}

interface TreeNodeProps {
  node: TreeNode;
  selectedId: string | null;
  expandedNodes: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onAddService: (parentId: string) => void;
  onAddGroup: (parentId: string) => void;
  onDelete: (id: string) => void;
  level: number;
}

function TreeNode({
  node,
  selectedId,
  expandedNodes,
  onSelect,
  onToggleExpand,
  onAddService,
  onAddGroup,
  onDelete,
  level
}: TreeNodeProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { execute } = useCommands();

  const isSelected = node.id === selectedId;
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const canHaveChildren = node.type === 'root' || node.type === 'group';

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('nodeId', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (canHaveChildren) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const draggedNodeId = e.dataTransfer.getData('nodeId');
    if (draggedNodeId && draggedNodeId !== node.id && canHaveChildren) {
      const command = new MoveNodeCommand(draggedNodeId, node.id, undefined, 'Move node');
      execute(command);
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
    <div>
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
          isSelected && "bg-primary/10 border border-primary/20",
          isDragOver && "bg-blue-50 border border-blue-200",
          "hover:bg-gray-50"
        )}
        style={{ marginLeft: level * 16 }}
        onClick={() => onSelect(node.id)}
        draggable={node.type !== 'root'}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        {/* Icon */}
        <span className="text-sm">{getNodeIcon()}</span>

        {/* Label */}
        <span className="flex-1 text-sm font-medium truncate">
          {node.label}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canHaveChildren && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                  <Plus size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onAddService(node.id)}>
                  Add Service
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddGroup(node.id)}>
                  Add Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {node.type !== 'root' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(node.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="ml-2">
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onAddService={onAddService}
              onAddGroup={onAddGroup}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}