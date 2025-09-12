import React from 'react';
import { ViewType } from '../../core/models/types';
import { TreeView } from '../views/TreeView';
import { NodeEditor } from '../views/NodeEditor';
import { FormSettings } from '../views/FormSettings';

interface ViewRouterProps {
  view: ViewType;
}

export function ViewRouter({ view }: ViewRouterProps) {
  switch (view) {
    case 'tree':
      return (
        <div className="p-6 h-full overflow-auto">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6">Form Structure</h2>
            <TreeView />
          </div>
        </div>
      );
      
    case 'editor':
      return (
        <div className="p-6 h-full overflow-auto">
          <div className="max-w-4xl mx-auto">
            <NodeEditor />
          </div>
        </div>
      );
      
    case 'settings':
      return (
        <div className="p-6 h-full overflow-auto">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6">Form Settings</h2>
            <FormSettings />
          </div>
        </div>
      );
      
    case 'preview':
      return (
        <div className="h-full border border-border rounded-lg m-4 bg-white">
          <div className="p-6">
            <h2 className="text-2xl font-semibold mb-6">Form Preview</h2>
            <div className="text-gray-500">
              Preview functionality will be implemented here
            </div>
          </div>
        </div>
      );
      
    default:
      return (
        <div className="p-6 h-full flex items-center justify-center">
          <div className="text-gray-500">View not found</div>
        </div>
      );
  }
}