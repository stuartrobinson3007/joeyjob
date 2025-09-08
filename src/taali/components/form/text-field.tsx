import { Control, FieldPath, FieldValues, RegisterOptions } from 'react-hook-form'

import { 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage, 
  FormDescription 
} from '@/ui/form'
import { Input } from '@/ui/input'

interface TextFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  placeholder?: string
  description?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
  disabled?: boolean
  rules?: Omit<RegisterOptions<TFieldValues>, 'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'>
  className?: string
}

/**
 * Reusable text field component for React Hook Form
 * 
 * Features:
 * - Full TypeScript support
 * - Integrated validation display
 * - Optional description text
 * - Support for various input types
 */
export function TextField<TFieldValues extends FieldValues>({ 
  control, 
  name, 
  label, 
  placeholder, 
  description,
  type = 'text',
  disabled = false,
  rules,
  className
}: TextFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input 
              {...field} 
              type={type}
              placeholder={placeholder}
              disabled={disabled}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}