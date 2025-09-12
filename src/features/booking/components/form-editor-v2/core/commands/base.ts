/**
 * Base command interface for implementing the command pattern
 * Enables undo/redo functionality and operation tracking
 */
export interface Command {
  id: string;
  timestamp: number;
  execute(): void | Promise<void>;
  undo(): void;
  redo(): void;
  canExecute(): boolean;
  description: string;
}

/**
 * Abstract base command implementation
 */
export abstract class BaseCommand implements Command {
  public readonly id: string;
  public readonly timestamp: number;
  public abstract readonly description: string;

  constructor() {
    this.id = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = Date.now();
  }

  abstract execute(): void | Promise<void>;
  abstract undo(): void;
  abstract canExecute(): boolean;

  redo(): void {
    this.execute();
  }
}

/**
 * Composite command for executing multiple commands as a single operation
 */
export class CompositeCommand extends BaseCommand {
  public readonly description: string;
  private commands: Command[] = [];

  constructor(description: string, commands: Command[] = []) {
    super();
    this.description = description;
    this.commands = commands;
  }

  addCommand(command: Command): void {
    this.commands.push(command);
  }

  async execute(): Promise<void> {
    for (const command of this.commands) {
      if (command.canExecute()) {
        await command.execute();
      }
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  canExecute(): boolean {
    return this.commands.length > 0 && this.commands.every(cmd => cmd.canExecute());
  }
}