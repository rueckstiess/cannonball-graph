// src/core/node-registry.ts
import { Node as MdastNode } from 'mdast';
import type { NodeType } from './types';
import { BaseNode } from './node';
import { ParserContext } from '@/parser/parser-context';

/**
 * Type for node classes with the required static methods
 */
export interface NodeClass {
  // The constructor signature
  new(...args: any[]): BaseNode;

  // Static methods
  fromAst(astNode: MdastNode, context: ParserContext, ancestors: MdastNode[]): BaseNode | null;
  canParseAst(astNode: MdastNode): boolean;
}

/**
 * Registry for node classes to allow dynamic lookup
 */
export class NodeRegistry {
  private static typeRegistry = new Map<NodeType, NodeClass>();
  private static astParserRegistry: NodeClass[] = [];

  /**
   * Register a node class for a specific node type
   */
  static register(nodeType: NodeType, nodeClass: NodeClass): void {
    // Register for type-based lookups
    this.typeRegistry.set(nodeType, nodeClass);

    // Register for AST parsing
    if (!this.astParserRegistry.includes(nodeClass)) {
      this.astParserRegistry.push(nodeClass);
    }
  }

  /**
   * Get a node class constructor for a specific node type
   */
  static getNodeClass(nodeType: NodeType): NodeClass | undefined {
    return this.typeRegistry.get(nodeType);
  }

  /**
   * Get all registered node classes that can parse AST nodes
   */
  static getAstParserClasses(): NodeClass[] {
    return [...this.astParserRegistry];
  }

  /**
   * Find a node class that can parse a specific AST node
   */
  static findParserForAst(astNode: MdastNode): NodeClass | undefined {
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