import { FormFieldConfig } from '@/features/booking/lib/form-field-types';

// Base Node interface with discriminated union for type safety
export type Node = 
  | RootNode
  | ServiceNode
  | GroupNode;

export interface BaseNode {
  id: string;
  parentId: string | null;
}

export interface RootNode extends BaseNode {
  type: 'root';
  title: string;
  childIds: string[];
}

export interface ServiceNode extends BaseNode {
  type: 'service';
  serviceId: string;
  label: string;
  description?: string;
  price?: number;
  duration?: number;
  bufferTime?: number;
  interval?: number;
  questionIds: string[];
  
  // Scheduling properties
  dateRangeType?: "rolling" | "fixed" | "indefinite";
  rollingDays?: number;
  rollingUnit?: "calendar-days" | "week-days";
  fixedStartDate?: string;
  fixedEndDate?: string;
  minimumNotice?: number;
  minimumNoticeUnit?: "days" | "hours";
  bookingInterval?: number;
  
  // Availability rules
  availabilityRules?: Array<{
    days: number[];
    timeRanges: Array<{ start: string; end: string }>;
  }>;
  blockedTimes?: Array<{
    date: any;
    timeRanges: Array<{ start: string; end: string }>;
  }>;
  unavailableDates?: any[];
  
  // Employee assignment
  assignedEmployeeIds?: string[];
  defaultEmployeeId?: string;
}

export interface GroupNode extends BaseNode {
  type: 'group';
  label: string;
  description?: string;
  childIds: string[];
}

// Question interface (normalized)
export interface Question {
  id: string;
  serviceId: string;
  config: FormFieldConfig;
  order: number;
}

// Tree representation for display (computed from normalized data)
export interface TreeNode {
  id: string;
  type: Node['type'];
  label: string;
  children: TreeNode[];
  // Include all original properties for backward compatibility
  [key: string]: any;
}

// Enhanced node with computed relationships
export type NodeWithDetails = Node & {
  questions: Question[];
  parent: Node | null;
  children: Node[];
};

// Form state
export interface FormState {
  // Domain data
  id: string;
  name: string;
  slug: string;
  theme: 'light' | 'dark';
  primaryColor: string;
  
  // Normalized data structures
  nodes: Record<string, Node>;
  questions: Record<string, Question>;
  baseQuestions: FormFieldConfig[];
  rootId: string;
  
  // Metadata
  lastSaved?: Date;
  isDirty: boolean;
}

// View types
export type ViewType = 'tree' | 'editor' | 'preview' | 'settings';

// Navigation state
export interface NavigationState {
  selectedNodeId: string | null;
  currentView: ViewType;
  breadcrumb: Array<{ id: string; label: string }>;
}