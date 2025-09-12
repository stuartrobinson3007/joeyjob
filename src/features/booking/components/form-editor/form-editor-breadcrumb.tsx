import React, { useMemo } from 'react';
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/taali/components/ui/breadcrumb';
import { NavigationLevel } from './hooks/use-form-editor-state';
import { FlowNode } from './form-flow-tree';

interface FormEditorBreadcrumbProps {
    currentLevel: NavigationLevel;
    selectedNode?: FlowNode | null;
    onNavigate: (level: NavigationLevel) => void;
    className?: string;
}

interface BreadcrumbItemData {
    label: string;
    level: NavigationLevel;
    isActive: boolean;
    key?: string; // Optional unique key for cases where level is not unique
}

export function FormEditorBreadcrumb({
    currentLevel,
    selectedNode,
    onNavigate,
    className = ''
}: FormEditorBreadcrumbProps) {
    const breadcrumbItems = useMemo(() => {
        const items: BreadcrumbItemData[] = [];

        // Always add root as the first item
        items.push({
            label: 'All settings',
            level: 'root',
            isActive: currentLevel === 'root'
        });

        // Add second-level items based on current navigation
        if (currentLevel === 'services' || 
            currentLevel === 'group-details' || 
            currentLevel === 'service-details' ||
            currentLevel === 'service-details-form' ||
            currentLevel === 'service-scheduling' ||
            currentLevel === 'service-questions' ||
            currentLevel === 'service-employees') {
            items.push({
                label: 'Services',
                level: 'services',
                isActive: currentLevel === 'services'
            });
        } else if (currentLevel === 'questions') {
            items.push({
                label: 'Questions',
                level: 'questions',
                isActive: true
            });
        } else if (currentLevel === 'branding') {
            items.push({
                label: 'Branding',
                level: 'branding',
                isActive: true
            });
        }

        // Add third-level items for service/group details
        if ((currentLevel === 'group-details' || 
             currentLevel === 'service-details' ||
             currentLevel === 'service-details-form' ||
             currentLevel === 'service-scheduling' ||
             currentLevel === 'service-questions' ||
             currentLevel === 'service-employees') && selectedNode) {
            
            const nodeLabel = selectedNode.type === 'split' 
                ? `${selectedNode.label} (Group)` 
                : selectedNode.label;
            
            if (currentLevel === 'group-details') {
                items.push({
                    label: nodeLabel,
                    level: 'group-details',
                    isActive: true
                });
            } else if (currentLevel === 'service-details') {
                items.push({
                    label: nodeLabel,
                    level: 'service-details',
                    isActive: true
                });
            } else if (currentLevel === 'service-details-form' ||
                       currentLevel === 'service-scheduling' ||
                       currentLevel === 'service-questions' ||
                       currentLevel === 'service-employees') {
                // Add service options level
                items.push({
                    label: nodeLabel,
                    level: 'service-details',
                    isActive: false
                });

                // Add specific service detail view
                let detailLabel = '';
                switch (currentLevel) {
                    case 'service-details-form':
                        detailLabel = 'Details';
                        break;
                    case 'service-scheduling':
                        detailLabel = 'Scheduling';
                        break;
                    case 'service-questions':
                        detailLabel = 'Questions';
                        break;
                    case 'service-employees':
                        detailLabel = 'Employees';
                        break;
                }
                items.push({
                    label: detailLabel,
                    level: currentLevel,
                    isActive: true
                });
            }
        }

        return items;
    }, [currentLevel, selectedNode]);

    if (breadcrumbItems.length <= 1) {
        // Don't show breadcrumb when we're at root level only
        return null;
    }

    return (
        <Breadcrumb className={`mb-4 ${className}`}>
            <BreadcrumbList>
                {breadcrumbItems.map((item, index) => (
                    <React.Fragment key={item.key || item.level}>
                        <BreadcrumbItem>
                            {item.isActive ? (
                                <BreadcrumbPage>{item.label}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink
                                    className="cursor-pointer"
                                    onClick={() => onNavigate(item.level)}
                                >
                                    {item.label}
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                        {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
                    </React.Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

export default FormEditorBreadcrumb;