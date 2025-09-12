import React from 'react';
import { Button } from '@/taali/components/ui/button';
import { Badge } from '@/taali/components/ui/badge';
import { Undo2, Redo2, Save, Settings, Eye, Loader2, AlertCircle, Clock } from 'lucide-react';
import { useFormStore } from '../../stores/form-store';
import { useUIStore } from '../../stores/ui-store';

interface FormEditorHeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave?: () => Promise<void>;
  isSaving?: boolean;
  isValidating?: boolean;
  hasErrors?: boolean;
  hasPendingUpdates?: boolean;
  lastSaved?: Date | null;
}

export function FormEditorHeader({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  isSaving = false,
  isValidating = false,
  hasErrors = false,
  hasPendingUpdates = false,
  lastSaved
}: FormEditorHeaderProps) {
  const { name, isDirty } = useFormStore();
  const { currentView, setView, showPreview, togglePreview } = useUIStore();
  
  const formatLastSaved = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes === 0) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <header className="border-b border-border bg-white px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold truncate">
            {name || 'Untitled Form'}
            {isDirty && <span className="text-orange-500 ml-2">•</span>}
          </h1>
          
          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {isSaving && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 size={12} className="animate-spin" />
                Saving
              </Badge>
            )}
            
            {isValidating && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 size={12} className="animate-spin" />
                Validating
              </Badge>
            )}
            
            {hasErrors && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle size={12} />
                Errors
              </Badge>
            )}
            
            {hasPendingUpdates && (
              <Badge variant="outline" className="gap-1">
                <Clock size={12} />
                Pending
              </Badge>
            )}
            
            {lastSaved && (
              <span className="text-sm text-gray-500">
                Saved {formatLastSaved(lastSaved)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Tabs */}
          <div className="flex items-center gap-1 mr-4">
            <Button
              variant={currentView === 'tree' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('tree')}
            >
              Structure
            </Button>
            <Button
              variant={currentView === 'editor' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('editor')}
            >
              Editor
            </Button>
            <Button
              variant={currentView === 'settings' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('settings')}
              className="gap-2"
            >
              <Settings size={16} />
              Settings
            </Button>
          </div>

          {/* Action buttons */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            className="gap-2"
          >
            <Undo2 size={16} />
            Undo
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRedo}
            disabled={!canRedo}
            className="gap-2"
          >
            <Redo2 size={16} />
            Redo
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={togglePreview}
            className="gap-2"
          >
            <Eye size={16} />
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>

          {onSave && (
            <Button
              onClick={onSave}
              disabled={!isDirty || isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}