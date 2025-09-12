import React, { useState, useEffect, useRef } from "react";
import FormEditorBreadcrumb from "@/features/booking/components/form-editor/form-editor-breadcrumb";
import type { FlowNode } from "../form-flow-tree";
import type { NavigationLevel } from "../hooks/use-form-editor-state";

interface ServiceDetailsViewProps {
    node: FlowNode;
    onNavigateBack: () => void;
    currentLevel?: NavigationLevel;
    onNavigate?: (level: NavigationLevel) => void;
    onUpdateNode?: (nodeId: string, updates: Partial<FlowNode>) => void;
}

/**
 * Service details view for editing basic service information
 */
export function ServiceDetailsView({
    node,
    onNavigateBack,
    currentLevel = 'service-details-form',
    onNavigate,
    onUpdateNode
}: ServiceDetailsViewProps) {
    const [title, setTitle] = useState(node?.label || '');
    const [description, setDescription] = useState(node?.description || '');
    const [price, setPrice] = useState(() => {
        if (!node?.price) return '';
        // Handle both existing formatted strings and new numeric values
        return typeof node.price === 'string' ? node.price.replace(/^\$/, '') : node.price.toString();
    });

    // Track if user has edited each field to prevent useEffect from overriding their changes
    const hasEditedRef = useRef({
        title: false,
        description: false,
        price: false
    });

    // Track if this is the first time mounting the component
    const isInitialMount = useRef(true);

    useEffect(() => {
        // On initial mount, always set the values from the node
        if (isInitialMount.current) {
            if (node) {
                setTitle(node.label);
                setDescription(node.description || '');
                const displayPrice = !node.price ? '' : 
                    typeof node.price === 'string' ? node.price.replace(/^\$/, '') : node.price.toString();
                setPrice(displayPrice);
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
            if (!hasEditedRef.current.price) {
                const displayPrice = !node.price ? '' : 
                    typeof node.price === 'string' ? node.price.replace(/^\$/, '') : node.price.toString();
                setPrice(displayPrice);
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

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPrice = e.target.value;
        setPrice(newPrice);
        hasEditedRef.current.price = true;
        if (onUpdateNode && node) {
            // Store price as number, not formatted string
            const numericPrice = newPrice === '' ? 0 : parseFloat(newPrice) || 0;
            onUpdateNode(node.id, { price: numericPrice });
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
            <h2 className="text-2xl font-bold mb-2">Service Details</h2>

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
                        The name of the service as shown to customers
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
                        Explain what this service includes and any information customers should know
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-medium mb-2">Price</h3>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                            $
                        </span>
                        <input
                            type="text"
                            className="w-full pl-8 p-2 border rounded-md"
                            value={price.replace(/^\$/, '')}
                            onChange={handlePriceChange}
                            placeholder="Enter price"
                        />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Leave blank if price varies or is determined after booking
                    </p>
                </div>
            </div>
        </>
    );
}

export default ServiceDetailsView;