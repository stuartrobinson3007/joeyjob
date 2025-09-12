import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/taali/components/ui/button';
import { Input } from '@/taali/components/ui/input';
import { Label } from '@/taali/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/taali/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/taali/components/ui/card';
import { useFormStore } from '../../stores/form-store';

export function FormSettings() {
  const { name, slug, theme, primaryColor, updateForm, isDirty } = useFormStore();
  
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      name: name || '',
      slug: slug || '',
      theme: theme || 'light',
      primaryColor: primaryColor || '#3B82F6'
    }
  });

  const onSubmit = async (data: any) => {
    updateForm(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Internal Name</Label>
            <Input
              id="name"
              {...register('name', { required: true })}
              placeholder="Enter form name"
            />
            <p className="text-sm text-gray-500 mt-1">
              This name is used internally to identify your form
            </p>
          </div>

          <div>
            <Label htmlFor="slug">URL Slug</Label>
            <Input
              id="slug"
              {...register('slug', { required: true })}
              placeholder="my-booking-form"
            />
            <p className="text-sm text-gray-500 mt-1">
              This will be part of your form's public URL
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="theme">Theme</Label>
            <Select 
              value={watch('theme')} 
              onValueChange={(value) => setValue('theme', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="primaryColor">Primary Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="primaryColor"
                type="color"
                {...register('primaryColor')}
                className="w-16 h-10 p-1 border"
              />
              <Input
                {...register('primaryColor')}
                placeholder="#3B82F6"
                className="flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty}>
          Save Settings
        </Button>
      </div>
    </form>
  );
}