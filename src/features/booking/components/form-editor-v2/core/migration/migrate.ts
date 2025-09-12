import { nanoid } from 'nanoid';
import { FormState, Node, Question, RootNode, ServiceNode, GroupNode } from '../models/types';
import { BookingFlowData } from '../../../form-editor/types/form-editor-state';
import { FlowNode } from '../../../form-editor/form-flow-tree';

/**
 * Migrates from the old nested tree format to the new normalized format
 */
export function migrateFromOldFormat(oldData: BookingFlowData): FormState {
  const nodes: Record<string, Node> = {};
  const questions: Record<string, Question> = {};
  let questionOrder = 0;

  /**
   * Recursively processes nodes and flattens the tree structure
   */
  function processNode(flowNode: FlowNode, parentId: string | null = null): Node {
    let node: Node;
    
    switch (flowNode.type) {
      case 'start':
        node = {
          id: flowNode.id,
          type: 'root',
          parentId,
          title: flowNode.label,
          childIds: []
        } as RootNode;
        break;
        
      case 'service':
        node = {
          id: flowNode.id,
          type: 'service',
          parentId,
          serviceId: flowNode.id, // Use node ID as service ID for now
          label: flowNode.label,
          description: flowNode.description,
          price: flowNode.price,
          duration: flowNode.duration,
          bufferTime: flowNode.bufferTime,
          interval: flowNode.interval,
          questionIds: [],
          
          // Scheduling properties
          dateRangeType: flowNode.dateRangeType,
          rollingDays: flowNode.rollingDays,
          rollingUnit: flowNode.rollingUnit,
          fixedStartDate: flowNode.fixedStartDate,
          fixedEndDate: flowNode.fixedEndDate,
          minimumNotice: flowNode.minimumNotice,
          minimumNoticeUnit: flowNode.minimumNoticeUnit,
          bookingInterval: flowNode.bookingInterval,
          
          // Availability rules
          availabilityRules: flowNode.availabilityRules,
          blockedTimes: flowNode.blockedTimes,
          unavailableDates: flowNode.unavailableDates,
          
          // Employee assignment
          assignedEmployeeIds: flowNode.assignedEmployeeIds,
          defaultEmployeeId: flowNode.defaultEmployeeId
        } as ServiceNode;
        
        // Process additional questions
        if (flowNode.additionalQuestions) {
          flowNode.additionalQuestions.forEach((questionConfig: any) => {
            const questionId = nanoid();
            const question: Question = {
              id: questionId,
              serviceId: flowNode.id,
              config: questionConfig,
              order: questionOrder++
            };
            
            questions[questionId] = question;
            (node as ServiceNode).questionIds.push(questionId);
          });
        }
        break;
        
      case 'split':
        node = {
          id: flowNode.id,
          type: 'group',
          parentId,
          label: flowNode.label,
          description: flowNode.description,
          childIds: []
        } as GroupNode;
        break;
        
      default:
        // Default to group for unknown types
        node = {
          id: flowNode.id,
          type: 'group',
          parentId,
          label: flowNode.label || 'Unknown',
          description: flowNode.description,
          childIds: []
        } as GroupNode;
        break;
    }
    
    nodes[flowNode.id] = node;
    
    // Process children
    if (flowNode.children && flowNode.children.length > 0) {
      const childNodes = flowNode.children.map(child => processNode(child, flowNode.id));
      
      if ('childIds' in node) {
        node.childIds = childNodes.map(child => child.id);
      }
    }
    
    return node;
  }
  
  // Start migration from the service tree
  const rootNode = processNode(oldData.serviceTree);
  
  // Process base questions
  const baseQuestions = oldData.baseQuestions || [];
  
  return {
    id: oldData.id,
    name: oldData.internalName,
    slug: oldData.slug,
    theme: oldData.theme,
    primaryColor: oldData.primaryColor,
    nodes,
    questions,
    baseQuestions,
    rootId: rootNode.id,
    isDirty: false,
    lastSaved: new Date()
  };
}

/**
 * Converts the normalized format back to the old nested tree format
 * Used for API compatibility and backward integration
 */
export function migrateToOldFormat(formState: FormState): BookingFlowData {
  const { nodes, questions, rootId } = formState;
  
  function buildTreeNode(nodeId: string): FlowNode {
    const node = nodes[nodeId];
    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`);
    }
    
    let flowNode: FlowNode;
    
    switch (node.type) {
      case 'root':
        flowNode = {
          id: node.id,
          type: 'start',
          label: node.title,
          children: []
        };
        break;
        
      case 'service':
        const serviceNode = node as ServiceNode;
        const additionalQuestions = serviceNode.questionIds
          .map(qId => questions[qId])
          .filter(q => q)
          .sort((a, b) => a.order - b.order)
          .map(q => q.config);
          
        flowNode = {
          id: serviceNode.id,
          type: 'service',
          label: serviceNode.label,
          description: serviceNode.description,
          price: serviceNode.price,
          duration: serviceNode.duration,
          bufferTime: serviceNode.bufferTime,
          interval: serviceNode.interval,
          
          // Scheduling properties
          dateRangeType: serviceNode.dateRangeType,
          rollingDays: serviceNode.rollingDays,
          rollingUnit: serviceNode.rollingUnit,
          fixedStartDate: serviceNode.fixedStartDate,
          fixedEndDate: serviceNode.fixedEndDate,
          minimumNotice: serviceNode.minimumNotice,
          minimumNoticeUnit: serviceNode.minimumNoticeUnit,
          bookingInterval: serviceNode.bookingInterval,
          
          // Availability rules
          availabilityRules: serviceNode.availabilityRules,
          blockedTimes: serviceNode.blockedTimes,
          unavailableDates: serviceNode.unavailableDates,
          
          // Employee assignment
          assignedEmployeeIds: serviceNode.assignedEmployeeIds,
          defaultEmployeeId: serviceNode.defaultEmployeeId,
          
          additionalQuestions
        };
        break;
        
      case 'group':
        const groupNode = node as GroupNode;
        flowNode = {
          id: groupNode.id,
          type: 'split',
          label: groupNode.label,
          description: groupNode.description,
          children: []
        };
        break;
    }
    
    // Process children
    if ('childIds' in node && node.childIds.length > 0) {
      flowNode.children = node.childIds.map(childId => buildTreeNode(childId));
    }
    
    return flowNode;
  }
  
  const serviceTree = buildTreeNode(rootId);
  
  return {
    id: formState.id,
    internalName: formState.name,
    slug: formState.slug,
    serviceTree,
    baseQuestions: formState.baseQuestions,
    theme: formState.theme,
    primaryColor: formState.primaryColor
  };
}

/**
 * Validates the integrity of migrated data
 */
export function validateMigratedData(formState: FormState): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { nodes, questions, rootId } = formState;
  
  // Check if root exists
  if (!nodes[rootId]) {
    errors.push(`Root node ${rootId} not found`);
  }
  
  // Check node relationships
  Object.values(nodes).forEach(node => {
    // Check parent-child relationships
    if (node.parentId) {
      const parent = nodes[node.parentId];
      if (!parent) {
        errors.push(`Parent node ${node.parentId} not found for node ${node.id}`);
      } else if ('childIds' in parent && !parent.childIds.includes(node.id)) {
        errors.push(`Node ${node.id} not found in parent's children list`);
      }
    }
    
    // Check child relationships
    if ('childIds' in node) {
      node.childIds.forEach(childId => {
        const child = nodes[childId];
        if (!child) {
          errors.push(`Child node ${childId} not found for parent ${node.id}`);
        } else if (child.parentId !== node.id) {
          errors.push(`Child node ${childId} has wrong parent reference`);
        }
      });
    }
    
    // Check service node questions
    if (node.type === 'service') {
      const serviceNode = node as ServiceNode;
      serviceNode.questionIds.forEach(qId => {
        const question = questions[qId];
        if (!question) {
          errors.push(`Question ${qId} not found for service ${node.id}`);
        } else if (question.serviceId !== node.id) {
          errors.push(`Question ${qId} has wrong service reference`);
        }
      });
    }
  });
  
  // Check orphaned questions
  Object.values(questions).forEach(question => {
    const serviceNode = nodes[question.serviceId] as ServiceNode;
    if (!serviceNode) {
      errors.push(`Service node ${question.serviceId} not found for question ${question.id}`);
    } else if (!serviceNode.questionIds.includes(question.id)) {
      errors.push(`Question ${question.id} not found in service's questions list`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}