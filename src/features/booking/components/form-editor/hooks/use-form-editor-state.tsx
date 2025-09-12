import { useState, useEffect, useCallback } from "react";
import { FlowNode } from "@/features/booking/components/form-editor/form-flow-tree";

/**
 * useFormEditorState manages UI-specific state for the form editor.
 * 
 * In the new architecture, this hook is focused solely on navigation and UI state management:
 * - Current navigation level (which view to show)
 * - Selection state (which node is selected)
 * - Service detail view (which sub-view of service details to show)
 * - Responsive UI state (mobile vs desktop)
 * 
 * It does NOT manage form data state like:
 * - Form settings (name, theme, colors)
 * - Service tree structure (adding, updating, removing nodes)
 * - Questions and their configurations
 * 
 * Those responsibilities are now handled by the FormEditorDataContext.
 */

// Navigation level types
export type NavigationLevel =
    | "root"
    | "services"
    | "questions"
    | "branding"
    | "group-details"
    | "service-details"
    | "service-details-form"
    | "service-scheduling"
    | "service-questions"
    | "service-employees";

// Service detail view types
export type ServiceDetailView = "details" | "employees" | "scheduling" | "questions";

interface FormEditorState {
    currentLevel: NavigationLevel;
    selectedNodeId: string | null;
    selectedNode: FlowNode | null;
    serviceDetailView: ServiceDetailView;
    isMobile: boolean;
}

interface FormEditorStateActions {
    navigateToLevel: (level: NavigationLevel) => void;
    navigateBack: () => void;
    selectNode: (id: string) => void;
    setServiceDetailView: (view: ServiceDetailView) => void;
    navigateToServiceDetail: (view: ServiceDetailView) => void;
    updateSelectedNodeOnly: (node: FlowNode) => void;
}

export function useFormEditorState(
    flowNodes?: FlowNode,
    externalSelectedNodeId?: string | null,
    onNodeSelect?: (id: string) => void
): [FormEditorState, FormEditorStateActions] {
    // Basic navigation level
    const [currentLevel, setCurrentLevel] = useState<NavigationLevel>("root");

    // Track selected nodes
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(externalSelectedNodeId || null);
    const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);

    // For service details, track which view we're on
    const [serviceDetailView, setServiceDetailView] = useState<ServiceDetailView>("details");

    // UI state
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Function to check if viewport is mobile
        const checkIfMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        // Check on initial load
        checkIfMobile();

        // Add event listener for window resize
        window.addEventListener('resize', checkIfMobile);

        // Clean up
        return () => window.removeEventListener('resize', checkIfMobile);
    }, []);

    // Update internal state when externalSelectedNodeId prop changes
    useEffect(() => {

        if (externalSelectedNodeId && flowNodes) {
            // Find the node in the flow tree
            const node = findNodeById(flowNodes, externalSelectedNodeId);

            // Always update the selected node ID
            setSelectedNodeId(externalSelectedNodeId);

            if (node) {
                // If we found the node, update the selected node reference
                setSelectedNode(node);

                // Navigate based on node type if we're at services level
                if (currentLevel === 'services') {
                    if (node.type === 'start') {
                        setCurrentLevel('group-details');
                    } else if (node.type === 'split') {
                        setCurrentLevel('group-details');
                    } else if (node.type === 'service') {
                        setCurrentLevel('service-details');
                        setServiceDetailView('details');
                    }
                }
            }
        } else if (externalSelectedNodeId === '') {
            // Special case: empty string means deselect
            setSelectedNodeId(null);
            setSelectedNode(null);
        }
    }, [externalSelectedNodeId, flowNodes, currentLevel]);

    // Function to find a node by ID in the flow nodes tree
    const findNodeById = (node: FlowNode | null, id: string): FlowNode | null => {
        if (!node) return null;
        if (node.id === id) return node;

        if (node.children) {
            for (const child of node.children) {
                const found = findNodeById(child, id);
                if (found) return found;
            }
        }

        return null;
    };

    /**
     * Select a node by ID and optionally force navigation to a specific level
     */
    const selectNode = useCallback(
        (nodeId: string, forceNavigationLevel?: NavigationLevel) => {

            // If forceNavigationLevel is provided, we'll navigate to that level
            if (forceNavigationLevel) {
                setCurrentLevel(forceNavigationLevel);
                setSelectedNodeId(nodeId);
                // Always update selectedNode as well
                if (flowNodes) {
                    const node = findNodeById(flowNodes, nodeId);
                    setSelectedNode(node);
                }
                return;
            }

            if (!flowNodes) {
                return;
            }

            const node = findNodeById(flowNodes, nodeId);
            if (!node) {
                return;
            }

            // Always update selected node and id, even if already selected
            setSelectedNodeId(nodeId);
            setSelectedNode(node);

            // Call external handler if provided
            if (onNodeSelect) {
                onNodeSelect(nodeId);
            }

            // Navigate to the appropriate detail view based on node type
            if (node.type === 'start') {
                setCurrentLevel('group-details');
            } else if (node.type === 'split') {
                setCurrentLevel('group-details');
            } else if (node.type === 'service') {
                setCurrentLevel('service-details');
                setServiceDetailView('details'); // Always reset detail view
            }
        },
        [currentLevel, flowNodes, onNodeSelect]
    );

    /**
     * Navigate to a specific level (e.g., ROOT, NODE, SERVICE_DETAIL)
     */
    const navigateLevel = useCallback(
        (level: NavigationLevel, nodeId?: string | null) => {

            setCurrentLevel(level);

            if (nodeId !== undefined) {
                setSelectedNodeId(nodeId);

                if (flowNodes && nodeId) {
                    const node = findNodeById(flowNodes, nodeId);
                    setSelectedNode(node);
                }
            }

            // Reset service detail view when navigating away from service detail levels
            if (level !== 'service-details' &&
                level !== 'service-details-form' &&
                level !== 'service-scheduling' &&
                level !== 'service-questions' &&
                level !== 'service-employees') {
                setServiceDetailView('details');
            }
        },
        [selectedNodeId, serviceDetailView, flowNodes]
    );

    // Navigate to a specific service detail view
    const navigateToServiceDetail = (view: ServiceDetailView) => {
        setServiceDetailView(view);

        // Map view to corresponding navigation level
        const levelMap: Record<ServiceDetailView, NavigationLevel> = {
            details: 'service-details-form',
            employees: 'service-employees',
            scheduling: 'service-scheduling',
            questions: 'service-questions'
        };

        setCurrentLevel(levelMap[view]);
    };

    // Handle navigation back
    const navigateBack = () => {

        // Handle navigation based on current level
        if (currentLevel === 'service-details-form' ||
            currentLevel === 'service-scheduling' ||
            currentLevel === 'service-questions' ||
            currentLevel === 'service-employees') {
            // If we're in a service detail view, go back to service options
            setCurrentLevel('service-details');
        } else if (currentLevel === 'service-details' || currentLevel === 'group-details') {
            // If we're in service options or group details, go back to services
            setCurrentLevel('services');
            setSelectedNodeId(null);
            setSelectedNode(null);

            // Call external handler to sync the parent component state
            if (onNodeSelect) {
                onNodeSelect('');  // Empty string indicates no selection
            }
        } else {
            // Otherwise go back to root
            setCurrentLevel('root');
        }
    };

    // Update the selected node without changing navigation level
    const updateSelectedNodeOnly = (node: FlowNode) => {
        setSelectedNode(node);
    };

    const state: FormEditorState = {
        currentLevel,
        selectedNodeId,
        selectedNode,
        serviceDetailView,
        isMobile
    };

    const actions: FormEditorStateActions = {
        navigateToLevel: navigateLevel,
        navigateBack,
        selectNode,
        setServiceDetailView,
        navigateToServiceDetail,
        updateSelectedNodeOnly
    };

    return [state, actions];
}