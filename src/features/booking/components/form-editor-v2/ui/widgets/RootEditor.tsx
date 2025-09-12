import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/taali/components/ui/button';
import { Input } from '@/taali/components/ui/input';
import { Label } from '@/taali/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/taali/components/ui/card';
import { RootNode, NodeWithDetails } from '../../core/models/types';
import { useCommands } from '../../hooks/use-commands';
import { UpdateNodeCommand } from '../../core/commands/node-commands';

interface RootEditorProps {
  node: NodeWithDetails & RootNode;
}

export function RootEditor({ node }: RootEditorProps) {
  const { execute } = useCommands();
  
  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      title: node.title
    }
  });

  const onSubmit = async (data: any) => {
    const command = new UpdateNodeCommand(node.id, data, 'Update form title');
    await execute(command);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Form Root</h2>
        <p className="text-gray-600">Configure the main properties of your booking form.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Form Title</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                {...register('title', { required: true })}
                placeholder="Enter form title"
              />
            </div>
          </CardContent>
        </Card>

        {/* Structure Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Form Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 mb-4">
              This form contains {node.children.length} top-level {node.children.length === 1 ? 'item' : 'items'}.
            </div>
            
            {node.children.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Your form is empty.</p>
                <p className="text-sm">Add services or groups from the tree view to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {node.children.map((child) => (
                  <div key={child.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded">
                    <span className="text-lg">
                      {child.type === 'service' ? '⚙️' : '📁'}
                    </span>
                    <span className="font-medium">
                      {child.type === 'service' ? (child as any).label : (child as any).label}
                    </span>
                    <span className="text-sm text-gray-500 capitalize">
                      ({child.type})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}