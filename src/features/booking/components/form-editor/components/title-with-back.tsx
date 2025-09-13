import { useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/taali/components/ui/button';
import { NavigationLevel } from '../hooks/use-form-editor-state';
import { FlowNode } from '../form-flow-tree';

interface TitleWithBackProps {
    title: string;
    currentLevel: NavigationLevel;
    selectedNode?: FlowNode | null;
    onNavigateBack: () => void;
    className?: string;
}

/**
 * Title component with conditional back button based on navigation state
 * Shows back button when there's a place to navigate back to (same logic as breadcrumb)
 */
export function TitleWithBack({
    title,
    currentLevel,
    selectedNode,
    onNavigateBack,
    className = ''
}: TitleWithBackProps) {
    
    // Use same logic as breadcrumb to determine if back navigation is available
    const canGoBack = useMemo(() => {
        // Replicate the breadcrumb logic to determine if we can go back
        const items = [];

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
                level: 'services' as NavigationLevel,
                isActive: currentLevel === 'services'
            });
        }

        if (currentLevel === 'questions') {
            items.push({
                label: 'Questions',
                level: 'questions' as NavigationLevel,
                isActive: true
            });
        }

        if (currentLevel === 'branding') {
            items.push({
                label: 'Branding',
                level: 'branding' as NavigationLevel,
                isActive: true
            });
        }

        // Add third-level items (node-specific)
        if ((currentLevel === 'group-details' || 
             currentLevel === 'service-details' ||
             currentLevel === 'service-details-form' ||
             currentLevel === 'service-scheduling' ||
             currentLevel === 'service-questions' ||
             currentLevel === 'service-employees') && selectedNode) {
            
            const nodeLabel = selectedNode.type === 'service' ? selectedNode.label : 
                             selectedNode.type === 'split' ? selectedNode.label : 
                             'Unknown';
            
            items.push({
                label: nodeLabel,
                level: currentLevel,
                isActive: currentLevel === 'group-details' || currentLevel === 'service-details'
            });
        }

        // Add fourth-level items (service detail specific views)
        if (currentLevel === 'service-details-form' ||
            currentLevel === 'service-scheduling' ||
            currentLevel === 'service-questions' ||
            currentLevel === 'service-employees') {
            
            const viewLabels = {
                'service-details-form': 'Details',
                'service-scheduling': 'Scheduling', 
                'service-questions': 'Questions',
                'service-employees': 'Team Assignment'
            };
            
            items.push({
                label: viewLabels[currentLevel],
                level: currentLevel,
                isActive: true
            });
        }

        // Can go back if there are more than 1 breadcrumb items (same as breadcrumb logic)
        return items.length > 1;
    }, [currentLevel, selectedNode]);

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {canGoBack && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNavigateBack}
                    className="p-1 h-8 w-8 rounded-md hover:bg-gray-100"
                    title="Go back"
                >
                    <ChevronLeft size={20} />
                </Button>
            )}
            <h2 className="text-2xl font-bold">{title}</h2>
        </div>
    );
}