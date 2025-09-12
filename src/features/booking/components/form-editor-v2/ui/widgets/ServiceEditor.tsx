import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/taali/components/ui/button';
import { Input } from '@/taali/components/ui/input';
import { Label } from '@/taali/components/ui/label';
import { Textarea } from '@/taali/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/taali/components/ui/card';
import { ServiceNode, NodeWithDetails } from '../../core/models/types';
import { useCommands } from '../../hooks/use-commands';
import { UpdateNodeCommand } from '../../core/commands/node-commands';

interface ServiceEditorProps {
  node: NodeWithDetails & ServiceNode;
}

export function ServiceEditor({ node }: ServiceEditorProps) {
  const { execute } = useCommands();
  
  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      label: node.label,
      description: node.description || '',
      price: node.price || 0,
      duration: node.duration || 60,
      bufferTime: node.bufferTime || 0
    }
  });

  const onSubmit = async (data: any) => {
    const command = new UpdateNodeCommand(node.id, data, 'Update service');
    await execute(command);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Service: {node.label}</h2>
        <p className="text-gray-600">Configure this service's basic properties and scheduling settings.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="label">Service Name</Label>
              <Input
                id="label"
                {...register('label', { required: true })}
                placeholder="Enter service name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe this service (optional)"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  {...register('price', { valueAsNumber: true })}
                />
              </div>

              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  {...register('duration', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="bufferTime">Buffer Time (minutes)</Label>
              <Input
                id="bufferTime"
                type="number"
                {...register('bufferTime', { valueAsNumber: true })}
                placeholder="Time to block after this service"
              />
            </div>
          </CardContent>
        </Card>

        {/* Questions Section */}
        <Card>
          <CardHeader>
            <CardTitle>Questions ({node.questions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {node.questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No questions added yet.</p>
                <Button variant="outline" className="mt-2">
                  Add Question
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {node.questions.map((question, index) => (
                  <div key={question.id} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                    <span className="text-sm">
                      {index + 1}. {question.config.label || 'Untitled Question'}
                    </span>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm">
                  Add Question
                </Button>
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