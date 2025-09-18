import React from 'react';
import { useFormStore } from '../../stores/form-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/taali/components/ui/card';

export function FormPreview() {
  const { name, getTree } = useFormStore();
  const tree = getTree();

  return (
    <div className="p-4 h-full">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border border-gray-200 rounded-lg bg-white">
            <h3 className="text-xl font-semibold mb-4">
              {tree?.label || 'Booking Form'}
            </h3>
            
            {!tree || tree.children.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No services configured</p>
                <p className="text-sm">Add services to see the preview</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-600 text-sm mb-4">
                  Choose from the following options:
                </p>
                
                {tree.children.map((child) => (
                  <div key={child.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        {child.type === 'service' ? '⚙️' : '📁'}
                      </div>
                      <div>
                        <h4 className="font-medium">{child.label}</h4>
                        {(child as any).description && (
                          <p className="text-sm text-gray-600">{(child as any).description}</p>
                        )}
                        {child.type === 'service' && (child as any).price !== undefined && (child as any).price !== null && (child as any).price > 0 && (
                          <p className="text-sm font-medium text-green-600">
                            ${(child as any).price}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="text-xs text-gray-400">
            This is a simplified preview. The actual form will have more interactive features.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}