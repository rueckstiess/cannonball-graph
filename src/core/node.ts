// src/core/node.ts
import { NodeType, TaskState } from './types';

/**
 * Base node class for all nodes in the Cannonball graph
 * Implements the Node interface and provides common functionality
 */
export abstract class BaseNode {
  id: string;
  type: NodeType;
  content: string;
  metadata: Record<string, unknown>;
  createdDate: Date;
  modifiedDate: Date;

  constructor(id: string, type: NodeType, content: string, metadata: Record<string, unknown> = {}) {
    this.id = id;
    this.type = type;
    this.content = content;
    this.metadata = metadata;
    this.createdDate = new Date();
    this.modifiedDate = new Date();
  }

  /**
   * Check if this node can contain the specified node
   * @param node - The node to check
   * @returns Whether this node can contain the specified node
   */
  abstract canContain(node: BaseNode): boolean;

  /**
   * Convert the node to a plain object representation
   * Useful for serialization and debugging
   */
  toObject(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      content: this.content,
      metadata: { ...this.metadata },
      createdDate: this.createdDate,
      modifiedDate: this.modifiedDate,
    };
  }
}

/**
 * Base class for nodes that can contain other nodes
 * Provides methods for managing containment hierarchy
 */
export abstract class ContainerNode extends BaseNode {
  /**
   * Get the containment level of this container
   * Used for determining hierarchical relationships
   */
  abstract getContainmentLevel(): number;

  /**
   * Check if this container should be removed from the container stack
   * when a new container is encountered
   * @param newContainer - The new container being processed
   */
  shouldPopFromContainerStack(newContainer: ContainerNode): boolean {
    return this.getContainmentLevel() >= newContainer.getContainmentLevel();
  }

  /**
   * Default implementation allows containers to contain any node
   * Subclasses can override for specific containment rules
   */
  canContain(node: BaseNode): boolean {
    return true;
  }
}

/**
 * Node representing a complete document/note
 */
export class NoteNode extends ContainerNode {
  constructor(id: string, title: string, metadata: Record<string, unknown> = {}) {
    super(id, NodeType.Note, title, metadata);
  }

  getContainmentLevel(): number {
    return 0; // Root level
  }

  canContain(node: BaseNode): boolean {
    // Notes can contain any node type except other notes
    return node.type !== NodeType.Note;
  }
}

/**
 * Node representing a section created by a heading
 */
export class SectionNode extends ContainerNode {
  constructor(id: string, title: string, level: number, metadata: Record<string, unknown> = {}) {
    super(id, NodeType.Section, title, {
      ...metadata,
      level
    });
  }

  get level(): number {
    return this.metadata.level as number;
  }

  getContainmentLevel(): number {
    return this.level;
  }

  canContain(node: BaseNode): boolean {
    // Sections can contain any node type
    // Containment is determined by heading levels in the parser
    return true;
  }

  shouldPopFromContainerStack(newContainer: ContainerNode): boolean {
    // If the new container is a section, compare heading levels
    if (newContainer instanceof SectionNode) {
      return this.level >= newContainer.level;
    }

    // Otherwise use default behavior
    return super.shouldPopFromContainerStack(newContainer);
  }
}

/**
 * Node representing a task item with a state
 */
export class TaskNode extends ContainerNode {
  constructor(
    id: string,
    content: string,
    state: TaskState = TaskState.Open,
    indentLevel: number = 0,
    metadata: Record<string, unknown> = {}
  ) {
    super(id, NodeType.Task, content, {
      ...metadata,
      taskState: state,
      indentLevel
    });
  }

  get state(): TaskState {
    return this.metadata.taskState as TaskState;
  }

  get indentLevel(): number {
    return this.metadata.indentLevel as number || 0;
  }

  getContainmentLevel(): number {
    return this.indentLevel;
  }

  canContain(node: BaseNode): boolean {
    // Tasks can contain other tasks, bullets, or content nodes
    return true;
  }

  shouldPopFromContainerStack(newContainer: ContainerNode): boolean {
    // If dealing with nested list items (tasks or bullets)
    if (newContainer instanceof TaskNode || newContainer instanceof BulletNode) {
      return this.indentLevel >= newContainer.indentLevel;
    }

    // For other containers, use default behavior
    return super.shouldPopFromContainerStack(newContainer);
  }
}

/**
 * Node representing a bullet list item
 */
export class BulletNode extends ContainerNode {
  constructor(
    id: string,
    content: string,
    indentLevel: number = 0,
    metadata: Record<string, unknown> = {}
  ) {
    super(id, NodeType.Bullet, content, {
      ...metadata,
      indentLevel
    });
  }

  get indentLevel(): number {
    return this.metadata.indentLevel as number || 0;
  }

  getContainmentLevel(): number {
    return this.indentLevel;
  }

  canContain(node: BaseNode): boolean {
    // Bullets can contain tasks, other bullets, and content nodes
    return true;
  }

  shouldPopFromContainerStack(newContainer: ContainerNode): boolean {
    // If dealing with nested list items (tasks or bullets)
    if (newContainer instanceof TaskNode || newContainer instanceof BulletNode) {
      return this.indentLevel >= newContainer.indentLevel;
    }

    // For other containers, use default behavior
    return super.shouldPopFromContainerStack(newContainer);
  }
}

/**
 * Base class for nodes that primarily contain content
 * rather than other nodes
 */
export abstract class ContentNode extends BaseNode {
  constructor(id: string, type: NodeType, content: string, metadata: Record<string, unknown> = {}) {
    super(id, type, content, metadata);
  }

  canContain(node: BaseNode): boolean {
    // Content nodes generally don't contain other nodes
    return false;
  }
}

/**
 * Node representing a paragraph of text
 */
export class ParagraphNode extends ContentNode {
  constructor(id: string, content: string, metadata: Record<string, unknown> = {}) {
    super(id, NodeType.Paragraph, content, metadata);
  }
}

/**
 * Node representing a code block
 */
export class CodeBlockNode extends ContentNode {
  constructor(id: string, content: string, language: string | null, metadata: Record<string, unknown> = {}) {
    super(id, NodeType.CodeBlock, content, {
      ...metadata,
      language
    });
  }

  get language(): string | null {
    return this.metadata.language as string || null;
  }
}

/**
 * Node for generic content that doesn't fit other categories
 */
export class GenericNode extends ContentNode {
  constructor(id: string, content: string, metadata: Record<string, unknown> = {}) {
    super(id, NodeType.Generic, content, metadata);
  }
}

/**
 * Factory for creating appropriate node instances based on type
 */
export class NodeFactory {
  /**
   * Create a node of the appropriate type
   * @param options - Node creation options
   * @returns The created node
   */
  static createNode(options: {
    id: string;
    type: NodeType;
    content: string;
    metadata?: Record<string, unknown>;
  }): BaseNode {
    const { id, type, content, metadata = {} } = options;

    switch (type) {
      case NodeType.Note:
        return new NoteNode(id, content, metadata);

      case NodeType.Section:
        return new SectionNode(
          id,
          content,
          metadata.level as number || 1,
          metadata
        );

      case NodeType.Task:
        return new TaskNode(
          id,
          content,
          metadata.taskState as TaskState || TaskState.Open,
          metadata.indentLevel as number || 0,
          metadata
        );

      case NodeType.Bullet:
        return new BulletNode(
          id,
          content,
          metadata.indentLevel as number || 0,
          metadata
        );

      case NodeType.Paragraph:
        return new ParagraphNode(id, content, metadata);

      case NodeType.CodeBlock:
        return new CodeBlockNode(
          id,
          content,
          metadata.language as string || null,
          metadata
        );

      default:
        return new GenericNode(id, content, metadata);
    }
  }

  /**
   * Create a node from a plain object representation
   * @param obj - The object representation
   * @returns The created node
   */
  static fromObject(obj: Record<string, unknown>): BaseNode {
    const node = NodeFactory.createNode({
      id: obj.id as string,
      type: obj.type as NodeType,
      content: obj.content as string,
      metadata: obj.metadata as Record<string, unknown>
    });

    if (obj.createdDate) {
      node.createdDate = new Date(obj.createdDate as string);
    }

    if (obj.modifiedDate) {
      node.modifiedDate = new Date(obj.modifiedDate as string);
    }

    return node;
  }
}