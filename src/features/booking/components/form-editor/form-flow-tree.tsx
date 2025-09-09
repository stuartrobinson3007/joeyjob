import React, { useState, useEffect, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { SplitIcon, ChevronDownIcon, EllipsisVerticalIcon, CalendarIcon, ChevronUpIcon, PlusIcon, GripVerticalIcon } from "lucide-react";
import { Button } from "@/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/ui/tooltip";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { FormFieldConfig } from "@/features/booking/lib/form-field-types";

// Create a context to track global dragging state
type DragContextType = {
    isDragging: boolean;
    setIsDragging: (dragging: boolean) => void;
};

const DragContext = createContext<DragContextType>({
    isDragging: false,
    setIsDragging: () => { }
});

// Node types
export type NodeType = "start" | "split" | "service";

// Node interface
export interface FlowNode {
    id: string;
    type: NodeType;
    label: string;
    children?: FlowNode[];
    // Additional properties for service configuration
    description?: string;
    price?: string;
    duration?: number;
    bufferTime?: number;
    interval?: number;
    // Added: Date range scheduling properties
    dateRangeType?: "rolling" | "fixed" | "indefinite";
    rollingDays?: number;
    rollingUnit?: "calendar-days" | "week-days";
    fixedStartDate?: string; // ISO date string
    fixedEndDate?: string; // ISO date string
    // Added: Minimum notice and booking interval properties
    minimumNotice?: number;
    minimumNoticeUnit?: "days" | "hours";
    bookingInterval?: number;
    availabilityRules?: Array<{
        days: number[];
        timeRanges: Array<{ start: string; end: string }>;
    }>;
    blockedTimes?: Array<{
        date: any; // Using any for now as the exact type depends on the implementation
        timeRanges: Array<{ start: string; end: string }>;
    }>;
    unavailableDates?: any[]; // Using any[] for now
    additionalQuestions?: FormFieldConfig[];
}

// TreeNode props
interface TreeNodeProps {
    node: FlowNode;
    level: number;
    maxDepth: number;
    isLast?: boolean;
    onToggle?: (id: string) => void;
    expandedNodes: Set<string>;
    onNodeAction?: (id: string, action: string) => void;
    onAddNode?: (parentId: string, type: NodeType) => void;
    onReorder?: (parentId: string, newOrder: FlowNode[]) => void;
    parentId?: string; // Added to track parent for reordering
    onNodeSelect?: (id: string) => void; // New prop for node selection
}

// Main component props
export interface FormFlowTreeProps {
    data: FlowNode;
    maxDepth?: number;
    onNodeAction?: (id: string, action: string) => void;
    onAddNode?: (parentId: string, type: NodeType) => void;
    onReorder?: (parentId: string, newOrder: FlowNode[]) => void;
    onNodeSelect?: (id: string) => void; // New prop for node selection
}

// Helper function to generate unique IDs
const generateUniqueId = (): string => {
    return `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// SortableTreeNode wrapper for drag and drop functionality
const SortableTreeNode: React.FC<TreeNodeProps & { id: string }> = (props) => {
    // Skip if this is a start node (shouldn't be sortable)
    if (props.node.type === "start") {
        return <TreeNode {...props} />;
    }

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: props.id });

    // Update global dragging state
    const { setIsDragging } = useContext(DragContext);

    useEffect(() => {
        if (isDragging) {
            setIsDragging(true);
        }
    }, [isDragging, setIsDragging]);

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        // Ensure dragged element has highest z-index
        zIndex: isDragging ? 1000 : undefined
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative",
                isDragging && "z-50"
            )}
            data-node-id={props.id}
        >
            <TreeNode
                {...props}
                isDragging={isDragging}
                dragHandleProps={{ attributes, listeners }}
            />
        </div>
    );
};

// TreeNode component (renders a single node)
const TreeNode: React.FC<TreeNodeProps & {
    isDragging?: boolean
    dragHandleProps?: {
        attributes?: any;
        listeners?: any;
    }
}> = ({
    node,
    level,
    maxDepth,
    isLast = false,
    onToggle,
    expandedNodes,
    onNodeAction,
    onAddNode,
    onReorder,
    parentId,
    isDragging,
    dragHandleProps,
    onNodeSelect
}) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.has(node.id);
        const [isHovered, setIsHovered] = useState(false);
        const { isDragging: isGlobalDragging } = useContext(DragContext);

        if (level > maxDepth) return null;

        const atMaxGroupDepth = level >= maxDepth - 1;

        const handleToggle = (e: React.MouseEvent) => {
            e.stopPropagation();
            onToggle && onToggle(node.id);
        };

        const handleNodeAction = (e: React.MouseEvent, action: string) => {
            e.stopPropagation();
            onNodeAction && onNodeAction(node.id, action);
        };

        const handleNodeClick = (e: React.MouseEvent) => {
            // Only handle clicks when not dragging and target is not a button
            if (!isGlobalDragging && !isDragging && onNodeSelect) {
                // Stop event propagation to prevent parent containers from handling the click
                e.stopPropagation();

                const target = e.target as HTMLElement;
                // Check if click is on the node itself, not on buttons inside it
                const isButton = target.closest('button') !== null;
                if (!isButton) {
                    onNodeSelect(node.id);
                }
            }
        };

        // Only allow hover states when not dragging
        const handleMouseEnter = () => {
            if (!isGlobalDragging) {
                setIsHovered(true);
            }
        };

        const handleMouseLeave = () => {
            setIsHovered(false);
        };

        const NodeContent = (
            <div
                className="relative bg-background"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div
                    className={cn(
                        "flex items-center space-x-3 rounded-lg p-2 hover:bg-primary/5 text-left group w-full cursor-pointer",
                        isDragging && "opacity-75 border border-dashed border-primary/50",
                        isGlobalDragging && "hover:bg-transparent" // Disable hover background during dragging
                    )}
                    onClick={handleNodeClick}
                >
                    <div
                        className="h-8 w-8 flex items-center justify-center bg-muted rounded-md border flex-shrink-0"
                        {...(isHovered && node.type !== "start" && dragHandleProps ? { ...dragHandleProps.attributes, ...dragHandleProps.listeners } : {})}
                    >
                        <div className="text-muted-foreground">
                            {isHovered && node.type !== "start" ? (
                                <GripVerticalIcon className="h-3.5 w-3.5 cursor-grab" />
                            ) : node.type === "service" ? (
                                <CalendarIcon className="h-3.5 w-3.5" />
                            ) : (
                                <SplitIcon className="h-3.5 w-3.5" />
                            )}
                        </div>
                    </div>

                    <div className="flex-1 text-sm font-medium">
                        {node.label}
                    </div>

                    <div className="flex-shrink-0 flex items-center space-x-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100 hover:bg-primary/5",
                                isGlobalDragging && "group-hover:opacity-0" // Hide during dragging
                            )}
                            onClick={(e) => handleNodeAction(e, "menu")}
                        >
                            <EllipsisVerticalIcon className="h-3.5 w-3.5" />
                        </Button>

                        {node.type === "split" && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-primary/5"
                                onClick={handleToggle}
                            >
                                {isExpanded ? (
                                    <ChevronUpIcon className="h-4 w-4" />
                                ) : (
                                    <ChevronDownIcon className="h-4 w-4" />
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );

        return (
            <>
                <div className="relative">
                    <div className="absolute h-px w-3 bg-border -left-4 top-6 z-10" />
                    {NodeContent}
                </div>

                {node.type === "start" || node.type === "split" ? (
                    <div className="relative">
                        <div className="absolute w-px h-full bg-border left-6 top-0 z-0" />

                        <AnimatePresence>
                            {(node.type === "start" || (node.type === "split" && isExpanded)) && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    {hasChildren ? (
                                        <NodeChildrenList
                                            parentId={node.id}
                                            children={node.children || []}
                                            level={level}
                                            maxDepth={maxDepth}
                                            expandedNodes={expandedNodes}
                                            onToggle={onToggle}
                                            onNodeAction={onNodeAction}
                                            onAddNode={onAddNode}
                                            onReorder={onReorder}
                                            onNodeSelect={onNodeSelect}
                                        />
                                    ) : node.type === "split" && isExpanded && (
                                        <NodeChildrenList
                                            parentId={node.id}
                                            children={[]}
                                            level={level}
                                            maxDepth={maxDepth}
                                            expandedNodes={expandedNodes}
                                            onToggle={onToggle}
                                            onNodeAction={onNodeAction}
                                            onAddNode={onAddNode}
                                            onReorder={onReorder}
                                            onNodeSelect={onNodeSelect}
                                        />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ) : null}
            </>
        );
    };

// New component to handle children
const NodeChildrenList: React.FC<{
    parentId: string;
    children: FlowNode[];
    level: number;
    maxDepth: number;
    expandedNodes: Set<string>;
    onToggle?: (id: string) => void;
    onNodeAction?: (id: string, action: string) => void;
    onAddNode?: (parentId: string, type: NodeType) => void;
    onReorder?: (parentId: string, newOrder: FlowNode[]) => void;
    onNodeSelect?: (id: string) => void;
}> = ({
    parentId,
    children,
    level,
    maxDepth,
    expandedNodes,
    onToggle,
    onNodeAction,
    onAddNode,
    onReorder,
    onNodeSelect
}) => {
        const atMaxGroupDepth = level >= maxDepth - 1;
        const [draggedGroups, setDraggedGroups] = useState<{ id: string, wasExpanded: boolean }[]>([]);
        const [activeId, setActiveId] = useState<string | null>(null);
        const [activeDragNode, setActiveDragNode] = useState<FlowNode | null>(null);

        // Access the drag context
        const { setIsDragging } = useContext(DragContext);

        // Create a combined array for normal children + add-option
        const realChildren = [...children];

        // For SortableContext, we only include non-start nodes
        const sortableItems = realChildren.filter(child => child.type !== "start").map(child => child.id);

        // Setup sensors for drag and drop
        const sensors = useSensors(
            useSensor(PointerSensor),
            useSensor(KeyboardSensor, {
                coordinateGetter: sortableKeyboardCoordinates,
            })
        );

        // Handle drag start - collapse any expanded groups being dragged
        const handleDragStart = (event: DragStartEvent) => {
            // Set global dragging state to true
            setIsDragging(true);

            const { active } = event;
            setActiveId(active.id.toString());

            // Store the active node for the overlay
            const draggedNode = realChildren.find(child => child.id === active.id);
            if (draggedNode) {
                setActiveDragNode(draggedNode);
            }

            const nodeToCollapse = realChildren.find(child => child.id === active.id);

            if (nodeToCollapse?.type === "split") {
                const wasExpanded = expandedNodes.has(nodeToCollapse.id);

                if (wasExpanded) {
                    // Store the information that this group was expanded
                    setDraggedGroups([...draggedGroups, { id: nodeToCollapse.id.toString(), wasExpanded }]);

                    // Collapse the group
                    onToggle && onToggle(nodeToCollapse.id);
                }
            }
        };

        // Handle drag end
        const handleDragEnd = (event: DragEndEvent) => {
            // Reset active states
            setActiveId(null);
            setActiveDragNode(null);

            // Reset global dragging state
            setIsDragging(false);

            const { active, over } = event;

            // First handle the reordering
            if (over && active.id !== over.id) {
                // Find indices in the real children array (not including the "Add option" item)
                const oldIndex = realChildren.findIndex(child => child.id === active.id);
                const newIndex = realChildren.findIndex(child => child.id === over.id);

                if (oldIndex !== -1 && newIndex !== -1) {
                    // Reorder the children array
                    const newOrder = arrayMove(realChildren, oldIndex, newIndex);

                    // Call the reorder handler
                    if (onReorder) {
                        onReorder(parentId, newOrder);
                    }
                }
            }

            // Then handle re-expanding any groups that were collapsed during drag
            setTimeout(() => {
                // The setTimeout helps ensure we re-expand after the reordering changes have been applied
                draggedGroups.forEach(group => {
                    if (group.wasExpanded) {
                        onToggle && onToggle(group.id);
                    }
                });
                setDraggedGroups([]);
            }, 50);
        };

        // Get the global dragging state
        const { isDragging: isGlobalDragging } = useContext(DragContext);

        // Add option marker with special ID
        const addOptionMarker: FlowNode = {
            id: `${parentId}-add-option`,
            type: "service",
            label: "Add option",
            children: []
        };

        // Add the marker for rendering
        const allItems = [...realChildren, addOptionMarker];

        const handleAddNode = (e: React.MouseEvent, type: NodeType) => {
            e.stopPropagation();
            onAddNode && onAddNode(parentId, type);
        };

        return (
            <div className="pl-10 relative z-0 pt-2">
                <div className="relative" style={{ zIndex: isGlobalDragging ? 10 : 'auto' }}>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={sortableItems}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="flex flex-col space-y-2">
                                {/* Render children nodes */}
                                {realChildren.map((child) => {
                                    // For start nodes, use normal TreeNode (not sortable)
                                    if (child.type === "start") {
                                        return (
                                            <TreeNode
                                                key={child.id}
                                                node={child}
                                                level={level + 1}
                                                maxDepth={maxDepth}
                                                isLast={child.id === children[children.length - 1]?.id}
                                                onToggle={onToggle}
                                                expandedNodes={expandedNodes}
                                                onNodeAction={onNodeAction}
                                                onAddNode={onAddNode}
                                                onReorder={onReorder}
                                                parentId={parentId}
                                                onNodeSelect={onNodeSelect}
                                            />
                                        );
                                    }

                                    // For other nodes, use SortableTreeNode
                                    return (
                                        <SortableTreeNode
                                            key={child.id}
                                            id={child.id}
                                            node={child}
                                            level={level + 1}
                                            maxDepth={maxDepth}
                                            isLast={child.id === children[children.length - 1]?.id}
                                            onToggle={onToggle}
                                            expandedNodes={expandedNodes}
                                            onNodeAction={onNodeAction}
                                            onAddNode={onAddNode}
                                            onReorder={onReorder}
                                            parentId={parentId}
                                            onNodeSelect={onNodeSelect}
                                        />
                                    );
                                })}

                                {/* Render "Add option" button - outside the SortableContext */}
                                <div key={addOptionMarker.id} className="relative">
                                    <TooltipProvider delayDuration={100}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <div
                                                    className={cn(
                                                        "flex items-center space-x-3 rounded-lg p-2 hover:bg-primary/5 hover:text-primary text-left group w-full cursor-pointer relative",
                                                        isGlobalDragging && "hover:bg-transparent hover:text-inherit cursor-default"
                                                    )}
                                                    onClick={(e) => isGlobalDragging ? e.preventDefault() : null}
                                                >
                                                    {/* Horizontal connector line for Add Option */}
                                                    <div className="absolute h-px w-3 bg-border -left-4 top-1/2 -translate-y-1/2 z-0" />
                                                    <div className={cn(
                                                        "h-8 w-8 flex items-center justify-center bg-background rounded-md border flex-shrink-0 group-hover:border-primary/40 group-hover:bg-primary/5",
                                                        isGlobalDragging && "group-hover:border-inherit group-hover:bg-background"
                                                    )}>
                                                        <div className="text-sm">
                                                            <PlusIcon className="h-3.5 w-3.5" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 text-sm font-medium">
                                                        Add option
                                                    </div>
                                                </div>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                {atMaxGroupDepth ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm opacity-50 outline-none">
                                                                <SplitIcon className="h-3.5 w-3.5 mr-2" />
                                                                Add Group
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Maximum group nesting depth reached.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <DropdownMenuItem
                                                        onClick={(e) => handleAddNode(e, "split")}
                                                        className="cursor-pointer"
                                                    >
                                                        <SplitIcon className="h-3.5 w-3.5 mr-2" />
                                                        Add Group
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    onClick={(e) => handleAddNode(e, "service")}
                                                    className="cursor-pointer"
                                                >
                                                    <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                                                    Add Service
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </SortableContext>

                        {/* Use a portal to render the drag overlay outside the DOM hierarchy */}
                        {createPortal(
                            <DragOverlay adjustScale={false} zIndex={1000}>
                                {activeId && activeDragNode && (
                                    <div className="opacity-40 w-full bg-background rounded-lg shadow-lg">
                                        <TreeNode
                                            node={activeDragNode}
                                            level={level + 1}
                                            maxDepth={maxDepth}
                                            isLast={false}
                                            expandedNodes={expandedNodes}
                                            onToggle={onToggle}
                                            onNodeAction={onNodeAction}
                                            onAddNode={onAddNode}
                                            onReorder={onReorder}
                                            onNodeSelect={onNodeSelect}
                                            parentId={parentId}
                                            isDragging={true}
                                        />
                                    </div>
                                )}
                            </DragOverlay>,
                            document.body
                        )}
                    </DndContext>
                </div>
            </div>
        );
    };

// Main component
export const FormFlowTree: React.FC<FormFlowTreeProps> = ({
    data,
    maxDepth = 4,
    onNodeAction,
    onAddNode: externalAddNode,
    onReorder: externalReorder,
    onNodeSelect
}) => {
    const [treeData, setTreeData] = useState<FlowNode>(() => {
        return JSON.parse(JSON.stringify(data))
    });
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([data.id]));
    const [isTreeDragging, setIsTreeDragging] = useState(false);

    // Track when component receives new props
    useEffect(() => {

        // Only synchronize on initial mount or if the structure has fundamentally changed
        // (like new nodes added from outside, nodes deleted, etc.) but NOT on reordering
        const dataNodeIds = getAllNodeIds(data);
        const treeDataNodeIds = getAllNodeIds(treeData);

        // Check if the sets of IDs are different (new nodes added/removed externally)
        const shouldUpdate = !areSetsEqual(
            new Set(dataNodeIds),
            new Set(treeDataNodeIds)
        );

        if (shouldUpdate) {
            // Carefully merge the data to preserve order where possible
            const mergedData = mergeTreesPreservingOrder(treeData, data);
            setTreeData(mergedData);

            // Ensure the root is expanded
            setExpandedNodes(prev => {
                const newSet = new Set(prev);
                newSet.add(data.id);
                return newSet;
            });
        }
    }, [data]);

    // Helper function to collect all node IDs in a tree
    const getAllNodeIds = (node: FlowNode): string[] => {
        const ids = [node.id];
        if (node.children) {
            node.children.forEach((child: FlowNode) => {
                ids.push(...getAllNodeIds(child));
            });
        }
        return ids;
    };

    // Helper function to check if two sets are equal
    const areSetsEqual = (set1: Set<string>, set2: Set<string>): boolean => {
        if (set1.size !== set2.size) return false;
        for (const item of set1) {
            if (!set2.has(item)) return false;
        }
        return true;
    };

    // Helper function to merge trees while preserving order where possible
    const mergeTreesPreservingOrder = (currentTree: FlowNode, newTree: FlowNode): FlowNode => {
        // Create a deep copy of the new tree as a starting point
        const result = JSON.parse(JSON.stringify(newTree));

        // If current tree doesn't have children, just return the new tree
        if (!currentTree.children) return result;

        // If new tree doesn't have children but current does, preserve current children
        if (!result.children && currentTree.children) {
            result.children = JSON.parse(JSON.stringify(currentTree.children));
            return result;
        }

        // Both trees have children, try to preserve order from current tree
        if (result.children && currentTree.children) {
            // Get map of child nodes by ID from current tree to preserve their structure
            const currentChildrenMap = new Map<string, FlowNode>();
            for (const child of currentTree.children) {
                currentChildrenMap.set(child.id, child);
            }

            // Keep track of the order in current tree
            const currentOrder: string[] = currentTree.children.map(child => child.id);

            // Create a new children array based on current order
            const newChildren: FlowNode[] = [];

            // First add all nodes that exist in both trees, in current tree's order
            currentOrder.forEach((id: string) => {
                const newChild = result.children?.find((child: FlowNode) => child.id === id);
                if (newChild) {
                    // Recursively merge this child with its counterpart in current tree
                    const currentChild = currentChildrenMap.get(id);
                    if (currentChild) {
                        newChildren.push(mergeTreesPreservingOrder(currentChild, newChild));
                    } else {
                        newChildren.push(JSON.parse(JSON.stringify(newChild)));
                    }
                }
            });

            // Then add any new nodes that only exist in the new tree
            result.children.forEach((child: FlowNode) => {
                if (!currentChildrenMap.has(child.id)) {
                    newChildren.push(JSON.parse(JSON.stringify(child)));
                }
            });

            result.children = newChildren;
        }

        return result;
    };

    const handleToggle = (id: string) => {
        // Get the node to toggle
        const findNode = (node: FlowNode): FlowNode | null => {
            if (node.id === id) {
                return node;
            }

            if (node.children) {
                for (const child of node.children) {
                    const found = findNode(child);
                    if (found) return found;
                }
            }

            return null;
        };

        const nodeToToggle = findNode(treeData);

        // Don't allow toggling of start nodes (they should always stay expanded)
        if (nodeToToggle?.type === "start") return;

        setExpandedNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                // If we're collapsing, just remove this node
                newSet.delete(id);
            } else {
                // If we're expanding, simply add this node to expanded set
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleAddNode = (parentId: string, type: NodeType) => {
        // First, find the parent node in the original tree
        let parentNode: FlowNode | null = null;

        const findParent = (node: FlowNode): boolean => {
            if (node.id === parentId) {
                parentNode = node;
                return true;
            }

            if (node.children) {
                for (const child of node.children) {
                    if (findParent(child)) {
                        return true;
                    }
                }
            }

            return false;
        };

        findParent(treeData);

        // Create a new node
        const newNode: FlowNode = {
            id: generateUniqueId(),
            type,
            label: type === "split" ? "New Group" : "New Service"
        };

        // Always update internal state first to ensure we have the latest tree data
        setTreeData(prevData => {
            // Create a deep copy of the tree
            const newData = JSON.parse(JSON.stringify(prevData));

            // Find the parent node again in the copied tree
            const updateTree = (node: FlowNode): boolean => {
                if (node.id === parentId) {
                    // Initialize children array if it doesn't exist
                    if (!node.children) {
                        node.children = [];
                    }

                    // Add the new node to the end of the children array
                    node.children.push(newNode);

                    // Auto-expand parent if not already expanded
                    setExpandedNodes(prev => {
                        const newSet = new Set(prev);

                        // Add the parent to expanded nodes
                        newSet.add(parentId);

                        // If this is a split node, collapse all sibling split nodes
                        if (type === "split") {
                            // Add the new node to expanded set (auto-expand it)
                            newSet.add(newNode.id);
                        }

                        return newSet;
                    });

                    return true;
                }

                if (node.children) {
                    for (const child of node.children) {
                        if (updateTree(child)) {
                            return true;
                        }
                    }
                }

                return false;
            };

            updateTree(newData);

            // Return the updated tree data
            return newData;
        });

        // If external handler is provided, call it AFTER updating internal state
        // This ensures our internal state is updated first before any external changes
        if (externalAddNode) {
            externalAddNode(parentId, type);
        }
    };

    const handleReorder = (parentId: string, newOrder: FlowNode[]) => {
        // If external handler is provided, call it
        if (externalReorder) {
            externalReorder(parentId, newOrder);
        }

        // Always update internal state
        setTreeData(prevData => {
            const newData = JSON.parse(JSON.stringify(prevData));

            const findAndUpdateOrder = (node: FlowNode): boolean => {
                if (node.id === parentId) {
                    node.children = newOrder;
                    return true;
                }

                if (node.children) {
                    for (const child of node.children) {
                        if (findAndUpdateOrder(child)) {
                            return true;
                        }
                    }
                }

                return false;
            };

            findAndUpdateOrder(newData);
            return newData;
        });
    };

    return (
        <DragContext.Provider value={{ isDragging: isTreeDragging, setIsDragging: setIsTreeDragging }}>
            <div className="flex flex-col">
                <TreeNode
                    node={treeData}
                    level={1}
                    maxDepth={maxDepth}
                    onToggle={handleToggle}
                    expandedNodes={expandedNodes}
                    onNodeAction={onNodeAction}
                    onAddNode={handleAddNode}
                    onReorder={handleReorder}
                    onNodeSelect={onNodeSelect}
                />
            </div>
        </DragContext.Provider>
    );
};

export default FormFlowTree;

// Example usage (uncomment and modify as needed):
/*
const exampleData: FlowNode = {
  id: "root",
  type: "start",
  label: "Start",
  children: [
    {
      id: "group1",
      type: "split",
      label: "Group name",
      children: [
        {
          id: "service1",
          type: "service",
          label: "Service name"
        },
        {
          id: "service2",
          type: "service",
          label: "Another service"
        }
      ]
    },
    {
      id: "group2",
      type: "split",
      label: "Another group",
      children: [
        {
          id: "service3",
          type: "service",
          label: "Third service"
        }
      ]
    }
  ]
};

// Usage in a component:
function MyComponent() {
  const handleNodeAction = (id: string, action: string) => {
    // Handle action
  };
  
  const handleReorder = (parentId: string, newOrder: FlowNode[]) => {
    // Update your state with the newOrder here
  };

  return (
    <FormFlowTree 
      data={exampleData} 
      onNodeAction={handleNodeAction}
      onReorder={handleReorder}
    />
  );
}
*/