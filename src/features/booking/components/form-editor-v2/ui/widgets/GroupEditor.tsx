import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/taali/components/ui/button';
import { Input } from '@/taali/components/ui/input';
import { Label } from '@/taali/components/ui/label';
import { Textarea } from '@/taali/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/taali/components/ui/card';
import { GroupNode, NodeWithDetails } from '../../core/models/types';
import { useCommands } from '../../hooks/use-commands';
import { UpdateNodeCommand } from '../../core/commands/node-commands';

interface GroupEditorProps {
  node: NodeWithDetails & GroupNode;
}

export function GroupEditor({ node }: GroupEditorProps) {
  const { execute } = useCommands();
  
  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      label: node.label,
      description: node.description || ''
    }
  });

  const onSubmit = async (data: any) => {
    const command = new UpdateNodeCommand(node.id, data, 'Update group');
    await execute(command);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Group: {node.label}</h2>
        <p className="text-gray-600">Configure this group's properties and organize its children.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="label">Group Name</Label>
              <Input
                id="label"
                {...register('label', { required: true })}
                placeholder="Enter group name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe this group (optional)"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Children Section */}
        <Card>
          <CardHeader>
            <CardTitle>Children ({node.children.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {node.children.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>This group has no children yet.</p>
                <p className="text-sm">Add services or sub-groups from the tree view.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {node.children.map((child) => (
                  <div key={child.id} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <div className="flex items-center gap-2">
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