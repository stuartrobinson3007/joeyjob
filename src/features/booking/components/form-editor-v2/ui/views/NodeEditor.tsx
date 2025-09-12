import React from 'react';
import { useFormStore } from '../../stores/form-store';
import { useUIStore } from '../../stores/ui-store';
import { ServiceEditor } from '../widgets/ServiceEditor';
import { GroupEditor } from '../widgets/GroupEditor';
import { RootEditor } from '../widgets/RootEditor';

export function NodeEditor() {
  const { selectedNodeId } = useUIStore();
  const getNodeWithDetails = useFormStore(state => state.getNodeWithDetails);

  if (!selectedNodeId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">No node selected</h3>
          <p className="text-sm">Select a node from the tree to edit its properties</p>
        </div>
      </div>
    );
  }

  const nodeDetails = getNodeWithDetails(selectedNodeId);
  
  if (!nodeDetails) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">Node not found</h3>
          <p className="text-sm">The selected node could not be found</p>
        </div>
      </div>
    );
  }

  switch (nodeDetails.type) {
    case 'root':
      return <RootEditor node={nodeDetails} />;
    case 'service':
      return <ServiceEditor node={nodeDetails} />;
    case 'group':
      return <GroupEditor node={nodeDetails} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Unknown node type</h3>
            <p className="text-sm">This node type is not supported</p>
          </div>
        </div>
      );
  }
}