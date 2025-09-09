import { useState } from 'react'
import { Trash2, GripVertical, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'

import { 
  FormFieldConfig, 
  FieldEditorProps, 
  fieldTypeLabels,
  FormFieldType 
} from '@/features/booking/lib/form-field-types'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'
import { Card, CardContent, CardHeader } from '@/ui/card'
import { cn } from '@/taali/lib/utils'

interface FieldOptionEditorProps {
  options: Array<{ label: string; value: string }>
  onChange: (options: Array<{ label: string; value: string }>) => void
}

function FieldOptionEditor({ options, onChange }: FieldOptionEditorProps) {
  const addOption = () => {
    const newOption = { label: `Option ${options.length + 1}`, value: `option_${options.length + 1}` }
    onChange([...options, newOption])
  }

  const updateOption = (index: number, field: 'label' | 'value', value: string) => {
    const newOptions = [...options]
    newOptions[index] = { ...newOptions[index], [field]: value }
    onChange(newOptions)
  }

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Options</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          className="h-7 px-2"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Option
        </Button>
      </div>
      
      {options.map((option, index) => (
        <div key={index} className="flex gap-2 items-center">
          <div className="flex-1">
            <Input
              placeholder="Option label"
              value={option.label}
              onChange={(e) => updateOption(index, 'label', e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="Option value"
              value={option.value}
              onChange={(e) => updateOption(index, 'value', e.target.value)}
              className="h-8"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeOption(index)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}

interface ContactInfoEditorProps {
  fieldConfig: Extract<FormFieldConfig, { type: 'contact-info' }>
  onChange: (updates: Partial<FormFieldConfig>) => void
}

function ContactInfoEditor({ fieldConfig, onChange }: ContactInfoEditorProps) {
  const updateConfig = (field: keyof typeof fieldConfig.fieldConfig, value: boolean) => {
    onChange({
      fieldConfig: {
        ...fieldConfig.fieldConfig,
        [field]: value
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="firstName"
            checked={fieldConfig.fieldConfig.firstNameRequired}
            onCheckedChange={(checked) => updateConfig('firstNameRequired', checked)}
          />
          <Label htmlFor="firstName" className="text-sm">First Name Required</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="lastName"
            checked={fieldConfig.fieldConfig.lastNameRequired}
            onCheckedChange={(checked) => updateConfig('lastNameRequired', checked)}
          />
          <Label htmlFor="lastName" className="text-sm">Last Name Required</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="email"
            checked={fieldConfig.fieldConfig.emailRequired}
            onCheckedChange={(checked) => updateConfig('emailRequired', checked)}
          />
          <Label htmlFor="email" className="text-sm">Email Required</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="phone"
            checked={fieldConfig.fieldConfig.phoneRequired}
            onCheckedChange={(checked) => updateConfig('phoneRequired', checked)}
          />
          <Label htmlFor="phone" className="text-sm">Phone Required</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="company"
            checked={fieldConfig.fieldConfig.companyRequired}
            onCheckedChange={(checked) => updateConfig('companyRequired', checked)}
          />
          <Label htmlFor="company" className="text-sm">Company Required</Label>
        </div>
      </div>
    </div>
  )
}

interface AddressEditorProps {
  fieldConfig: Extract<FormFieldConfig, { type: 'address' }>
  onChange: (updates: Partial<FormFieldConfig>) => void
}

function AddressEditor({ fieldConfig, onChange }: AddressEditorProps) {
  const updateConfig = (field: keyof typeof fieldConfig.fieldConfig, value: boolean) => {
    onChange({
      fieldConfig: {
        ...fieldConfig.fieldConfig,
        [field]: value
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="street"
            checked={fieldConfig.fieldConfig.streetRequired}
            onCheckedChange={(checked) => updateConfig('streetRequired', checked)}
          />
          <Label htmlFor="street" className="text-sm">Street Required</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="street2"
            checked={fieldConfig.fieldConfig.street2Required}
            onCheckedChange={(checked) => updateConfig('street2Required', checked)}
          />
          <Label htmlFor="street2" className="text-sm">Street 2 Required</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="city"
            checked={fieldConfig.fieldConfig.cityRequired}
            onCheckedChange={(checked) => updateConfig('cityRequired', checked)}
          />
          <Label htmlFor="city" className="text-sm">City Required</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="state"
            checked={fieldConfig.fieldConfig.stateRequired}
            onCheckedChange={(checked) => updateConfig('stateRequired', checked)}
          />
          <Label htmlFor="state" className="text-sm">State Required</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="zip"
            checked={fieldConfig.fieldConfig.zipRequired}
            onCheckedChange={(checked) => updateConfig('zipRequired', checked)}
          />
          <Label htmlFor="zip" className="text-sm">ZIP Required</Label>
        </div>
      </div>
    </div>
  )
}

export function FormFieldEditor({
  id,
  type,
  question,
  showOptions = false,
  onToggleOptions,
  onRemove,
  onUpdateField,
  isBeingDragged = false,
  showDragIcon = true,
  dragHandleProps = {},
  fieldConfig
}: FieldEditorProps) {
  const [isExpanded, setIsExpanded] = useState(showOptions)

  const handleLabelChange = (newLabel: string) => {
    onUpdateField(id, { question: newLabel })
    if (fieldConfig) {
      const updatedConfig = { ...fieldConfig, label: newLabel }
      onUpdateField(id, { fieldConfig: updatedConfig })
    }
  }

  const handleRequiredChange = (isRequired: boolean) => {
    if (fieldConfig && 'isRequired' in fieldConfig) {
      const updatedConfig = { ...fieldConfig, isRequired } as FormFieldConfig
      onUpdateField(id, { fieldConfig: updatedConfig })
    }
  }

  const handleFieldConfigChange = (updates: Partial<FormFieldConfig>) => {
    if (fieldConfig) {
      const updatedConfig = { ...fieldConfig, ...updates } as FormFieldConfig
      onUpdateField(id, { fieldConfig: updatedConfig })
    }
  }

  const handleOptionsChange = (newOptions: Array<{ label: string; value: string }>) => {
    if (fieldConfig && 'options' in fieldConfig) {
      const updatedConfig = { ...fieldConfig, options: newOptions }
      onUpdateField(id, { fieldConfig: updatedConfig })
    }
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
    if (onToggleOptions) {
      onToggleOptions()
    }
  }

  const hasOptions = type === 'dropdown' || type === 'multiple-choice'
  const hasComplexConfig = type === 'contact-info' || type === 'address'
  const hasRequiredToggle = fieldConfig && 'isRequired' in fieldConfig
  const showExpandButton = hasOptions || hasComplexConfig || hasRequiredToggle

  return (
    <Card className={cn(
      'relative transition-all duration-200',
      isBeingDragged && 'rotate-1 scale-105 shadow-lg',
      'hover:shadow-md'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {showDragIcon && (
              <div
                {...dragHandleProps?.attributes}
                {...dragHandleProps?.listeners}
                className="cursor-move text-muted-foreground hover:text-foreground"
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {fieldTypeLabels[type as FormFieldType] || type}
                </span>
              </div>
              
              <Input
                value={question || fieldConfig?.label || ''}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Field label..."
                className="mt-2 font-medium"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {showExpandButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleExpanded}
                className="h-8 w-8 p-0"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(id)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {hasRequiredToggle && fieldConfig && 'isRequired' in fieldConfig && (
              <div className="flex items-center space-x-2">
                <Switch
                  id={`${id}-required`}
                  checked={fieldConfig.isRequired}
                  onCheckedChange={handleRequiredChange}
                />
                <Label htmlFor={`${id}-required`} className="text-sm">
                  Required field
                </Label>
              </div>
            )}
            
            {type === 'contact-info' && fieldConfig?.type === 'contact-info' && (
              <ContactInfoEditor
                fieldConfig={fieldConfig}
                onChange={handleFieldConfigChange}
              />
            )}
            
            {type === 'address' && fieldConfig?.type === 'address' && (
              <AddressEditor
                fieldConfig={fieldConfig}
                onChange={handleFieldConfigChange}
              />
            )}
            
            {hasOptions && fieldConfig && 'options' in fieldConfig && (
              <FieldOptionEditor
                options={fieldConfig.options}
                onChange={handleOptionsChange}
              />
            )}
            
            {(type === 'short-text' || type === 'long-text') && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Validation</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`${id}-minLength`} className="text-xs">Min Length</Label>
                    <Input
                      id={`${id}-minLength`}
                      type="number"
                      placeholder="0"
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${id}-maxLength`} className="text-xs">Max Length</Label>
                    <Input
                      id={`${id}-maxLength`}
                      type="number"
                      placeholder="500"
                      className="h-8"
                    />
                  </div>
                </div>
                
                {type === 'short-text' && (
                  <div className="flex items-center space-x-2">
                    <Switch id={`${id}-email`} />
                    <Label htmlFor={`${id}-email`} className="text-sm">
                      Email validation
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}