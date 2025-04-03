// src/core/node.ts
import { Node as MdastNode, Paragraph, Text } from 'mdast';
import { NodeType } from './types';
import { ParserContext } from '@/parser/parser-context';
import { NodeRegistry } from './node-registry';


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

  /**
   * Create a basic paragraph AST node with the node's content
   * Used as a default implementation for toAst in content nodes
   */
  protected createParagraphAst(): Paragraph {
    const textNode: Text = {
      type: 'text',
      value: this.content
    };

    return {
      type: 'paragraph',
      children: [textNode]
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
  canContain(_node: BaseNode): boolean {
    return true;
  }

  /**
   * Adjusts the container stack when this node is added
   * @param context - The parser context with the container stack
   */
  adjustContainerStack(context: ParserContext): void {
    // Default implementation - pop containers until finding appropriate parent
    while (context.containerStack.length > 1) {
      const topContainer = context.containerStack[context.containerStack.length - 1];
      if (topContainer.shouldPopFromContainerStack(this)) {
        context.containerStack.pop();
      } else {
        break;
      }
    }
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
 * Factory for creating appropriate node instances based on type
 */
export class NodeFactory {
  /**
   * Create a node from a plain object representation
   * @param obj - The object representation
   * @returns The created node
   */
  static fromObject(obj: Record<string, unknown>): BaseNode {
    const nodeType = obj.type as NodeType;
    const NodeClass = NodeRegistry.getNodeClass(nodeType);

    if (!NodeClass) {
      throw new Error(`No node class registered for type ${nodeType}`);
    }

    // Create the node with the appropriate constructor
    // We need to provide at least the required arguments
    const node = new NodeClass(
      obj.id as string,
      obj.content as string,
      obj.metadata as Record<string, unknown>
    );

    // Set dates if available
    if (obj.createdDate) {
      node.createdDate = new Date(obj.createdDate as string);
    }

    if (obj.modifiedDate) {
      node.modifiedDate = new Date(obj.modifiedDate as string);
    }

    return node;
  }

  /**
   * Create a node from an AST node
   * @param astNode - The AST node
   * @param context - The parser context
   * @param ancestors - The ancestors of the AST node
   * @returns The created graph node, or null if no suitable parser found
   */
  static fromAst(
    astNode: MdastNode,
    context: ParserContext,
    ancestors: MdastNode[]
  ): BaseNode | null {
    // Find a node class that can parse this AST node
    const NodeClass = NodeRegistry.findParserForAst(astNode);

    if (!NodeClass) {
      return null;
    }

    // Use the node class's fromAst method
    return NodeClass.fromAst(astNode, context, ancestors);
  }
}