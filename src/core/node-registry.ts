// src/core/node-registry.ts
import { Node as MdastNode } from 'mdast';
import { NodeType } from './types';
import { BaseNode } from './node';
import { AstConvertible } from './ast-convertible';

/**
 * Interface for node class constructor with static methods
 */
export interface NodeClassConstructor {
  new(...args: []): BaseNode;
  fromAst: AstConvertible['fromAst'];
  canParseAst: AstConvertible['canParseAst'];
}

/**
 * Registry for node classes to allow dynamic lookup
 */
export class NodeRegistry {
  private static typeRegistry = new Map<NodeType, NodeClassConstructor>();
  private static astParserRegistry: NodeClassConstructor[] = [];

  /**
   * Register a node class for a specific node type
   * @param nodeType - The type of node
   * @param nodeClass - The node class constructor
   */
  static register(nodeType: NodeType, nodeClass: NodeClassConstructor): void {
    // Register for type-based lookups
    this.typeRegistry.set(nodeType, nodeClass);

    // Register for AST parsing if it implements the needed methods
    if (
      typeof nodeClass.fromAst === 'function' &&
      typeof nodeClass.canParseAst === 'function'
    ) {
      // Avoid duplicate registrations
      if (!this.astParserRegistry.includes(nodeClass)) {
        this.astParserRegistry.push(nodeClass);
      }
    }
  }

  /**
   * Get a node class constructor for a specific node type
   * @param nodeType - The type of node
   * @returns The node class constructor, or undefined if not found
   */
  static getNodeClass(nodeType: NodeType): NodeClassConstructor | undefined {
    return this.typeRegistry.get(nodeType);
  }

  /**
   * Get all registered node classes that can parse AST nodes
   * @returns Array of node class constructors
   */
  static getAstParserClasses(): NodeClassConstructor[] {
    return [...this.astParserRegistry];
  }

  /**
   * Find a node class that can parse a specific AST node
   * @param astNode - The AST node to parse
   * @returns The first node class that can parse this AST node, or undefined
   */
  static findParserForAst(astNode: MdastNode): NodeClassConstructor | undefined {
    return this.astParserRegistry.find(NodeClass =>
      NodeClass.canParseAst(astNode)
    );
  }

  /**
   * Clear all registrations (mainly for testing)
   */
  static clear(): void {
    this.typeRegistry.clear();
    this.astParserRegistry = [];
  }
}