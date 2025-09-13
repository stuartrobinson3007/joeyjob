import React, { useState, useEffect, useRef } from "react";
import FormEditorBreadcrumb from "@/features/booking/components/form-editor/form-editor-breadcrumb";
import { TitleWithBack } from "../components/title-with-back";
import type { FlowNode } from "../form-flow-tree";
import type { NavigationLevel } from "../hooks/use-form-editor-state";

interface GroupDetailsViewProps {
    node: FlowNode;
    onNavigateBack: () => void;
    currentLevel?: NavigationLevel;
    onNavigate?: (level: NavigationLevel) => void;
    onUpdateNode?: (nodeId: string, updates: Partial<FlowNode>) => void;
}

/**
 * Group details view for editing basic group information
 */
export function GroupDetailsView({
    node,
    onNavigateBack,
    currentLevel = 'group-details',
    onNavigate,
    onUpdateNode
}: GroupDetailsViewProps) {
    const [title, setTitle] = useState(node?.label || '');
    const [description, setDescription] = useState(node?.description || '');

    // Determine if this is a Start node or a regular group node
    const isStartNode = node.type === 'start';

    // Track if user has edited each field to prevent useEffect from overriding their changes
    const hasEditedRef = useRef({
        title: false,
        description: false
    });

    // Track if this is the first time mounting the component
    const isInitialMount = useRef(true);

    useEffect(() => {
        // On initial mount, always set the values from the node
        if (isInitialMount.current) {
            if (node) {
                setTitle(node.label);
                setDescription(node.description || '');
            }
            isInitialMount.current = false;
            return;
        }

        // On subsequent updates, only update the fields that haven't been edited
        if (node) {
            if (!hasEditedRef.current.title) {
                setTitle(node.label);
            }
            if (!hasEditedRef.current.description) {
                setDescription(node.description || '');
            }
        }
    }, [node]);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        hasEditedRef.current.title = true;
        if (onUpdateNode && node) {
            onUpdateNode(node.id, { label: newTitle });
        }
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newDescription = e.target.value;
        setDescription(newDescription);
        hasEditedRef.current.description = true;
        if (onUpdateNode && node) {
            onUpdateNode(node.id, { description: newDescription });
        }
    };

    if (!node) return null;

    return (
        <>
            <FormEditorBreadcrumb
                currentLevel={currentLevel}
                selectedNode={node}
                onNavigate={onNavigate || onNavigateBack}
                className="self-start"
            />
            <TitleWithBack
                title={isStartNode ? "Form Details" : "Group Details"}
                currentLevel={currentLevel}
                selectedNode={node}
                onNavigateBack={onNavigateBack}
                className="mb-6"
            />

            <div className="space-y-8">
                <div>
                    <h3 className="text-base font-medium mb-2">Title</h3>
                    <input
                        type="text"
                        className="w-full p-2 border rounded-md"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Enter a title"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                        {isStartNode
                            ? "This title will appear at the top of your customer-facing booking form"
                            : "The group name as shown to customers"
                        }
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-medium mb-2">Description</h3>
                    <textarea
                        className="w-full p-2 border rounded-md h-32"
                        value={description}
                        onChange={handleDescriptionChange}
                        placeholder="Enter a description"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                        {isStartNode
                            ? "This description appears to customers at the top of your booking form"
                            : "Description of the type of services in this group"
                        }
                    </p>
                </div>
            </div>
        </>
    );
}

export default GroupDetailsView;