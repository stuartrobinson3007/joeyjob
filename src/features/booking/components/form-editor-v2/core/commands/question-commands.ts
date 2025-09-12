import { BaseCommand } from './base';
import { Question, ServiceNode } from '../models/types';
import { FormFieldConfig } from '@/features/booking/lib/form-field-types';
import { useFormStore } from '../../stores/form-store';

/**
 * Command to add a question to a service
 */
export class AddQuestionCommand extends BaseCommand {
  public readonly description: string;
  private questionId?: string;

  constructor(
    private serviceId: string,
    private config: FormFieldConfig,
    description?: string
  ) {
    super();
    this.description = description || `Add question to service`;
  }

  execute(): void {
    const store = useFormStore.getState();
    this.questionId = store.addQuestion(this.serviceId, this.config);
  }

  undo(): void {
    if (this.questionId) {
      const store = useFormStore.getState();
      store.deleteQuestion(this.questionId);
    }
  }

  canExecute(): boolean {
    const store = useFormStore.getState();
    const serviceNode = store.nodes[this.serviceId] as ServiceNode;
    return !!serviceNode && serviceNode.type === 'service';
  }
}

/**
 * Command to delete a question
 */
export class DeleteQuestionCommand extends BaseCommand {
  public readonly description: string;
  private deletedQuestion?: Question;

  constructor(private questionId: string, description?: string) {
    super();
    this.description = description || `Delete question`;
  }

  execute(): void {
    const store = useFormStore.getState();
    const question = store.questions[this.questionId];
    
    if (!question) return;

    // Store deleted data for undo
    this.deletedQuestion = { ...question };

    store.deleteQuestion(this.questionId);
  }

  undo(): void {
    if (!this.deletedQuestion) return;

    const store = useFormStore.getState();
    
    // Restore the question
    store.questions[this.questionId] = this.deletedQuestion;
    
    // Add back to service node
    const serviceNode = store.nodes[this.deletedQuestion.serviceId] as ServiceNode;
    if (serviceNode && serviceNode.type === 'service') {
      if (!serviceNode.questionIds.includes(this.questionId)) {
        // Insert at correct position based on order
        const insertIndex = serviceNode.questionIds.findIndex(qId => {
          const q = store.questions[qId];
          return q && q.order > this.deletedQuestion!.order;
        });
        
        if (insertIndex === -1) {
          serviceNode.questionIds.push(this.questionId);
        } else {
          serviceNode.questionIds.splice(insertIndex, 0, this.questionId);
        }
      }
    }

    store.setDirty(true);
  }

  canExecute(): boolean {
    const store = useFormStore.getState();
    return !!store.questions[this.questionId];
  }
}

/**
 * Command to update a question
 */
export class UpdateQuestionCommand extends BaseCommand {
  public readonly description: string;
  private previousConfig?: FormFieldConfig;

  constructor(
    private questionId: string,
    private newConfig: FormFieldConfig,
    description?: string
  ) {
    super();
    this.description = description || `Update question`;
  }

  execute(): void {
    const store = useFormStore.getState();
    const question = store.questions[this.questionId];
    
    if (!question) return;

    // Store previous config for undo
    this.previousConfig = { ...question.config };

    store.updateQuestion(this.questionId, this.newConfig);
  }

  undo(): void {
    if (this.previousConfig) {
      const store = useFormStore.getState();
      store.updateQuestion(this.questionId, this.previousConfig);
    }
  }

  canExecute(): boolean {
    const store = useFormStore.getState();
    return !!store.questions[this.questionId];
  }
}

/**
 * Command to reorder questions within a service
 */
export class ReorderQuestionsCommand extends BaseCommand {
  public readonly description: string;
  private previousOrder?: string[];

  constructor(
    private serviceId: string,
    private newOrder: string[],
    description?: string
  ) {
    super();
    this.description = description || `Reorder questions`;
  }

  execute(): void {
    const store = useFormStore.getState();
    const serviceNode = store.nodes[this.serviceId] as ServiceNode;
    
    if (!serviceNode || serviceNode.type !== 'service') return;

    // Store previous order for undo
    this.previousOrder = [...serviceNode.questionIds];

    store.reorderQuestions(this.serviceId, this.newOrder);
  }

  undo(): void {
    if (this.previousOrder) {
      const store = useFormStore.getState();
      store.reorderQuestions(this.serviceId, this.previousOrder);
    }
  }

  canExecute(): boolean {
    const store = useFormStore.getState();
    const serviceNode = store.nodes[this.serviceId] as ServiceNode;
    return !!serviceNode && serviceNode.type === 'service';
  }
}