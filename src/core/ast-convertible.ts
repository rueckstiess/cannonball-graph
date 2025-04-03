// src/core/ast-convertible.ts
import { Node as MdastNode } from 'mdast';
import { ParserContext } from '@/parser/parser-context';
import { BaseNode } from './node';

/**
 * Interface for nodes that can be converted to/from MDAST nodes
 */
export interface AstConvertible {
  /**
   * Convert from an AST node to a graph node
   * @param astNode - The MDAST node to convert
   * @param context - The parser context with state information
   * @param ancestors - Array of ancestor MDAST nodes
   * @returns The created graph node, or null if this AST node can't be converted by this class
   */
  fromAst(
    astNode: MdastNode,
    context: ParserContext,
    ancestors: MdastNode[]
  ): BaseNode | null;

  /**
   * Check if this class can parse a given AST node type
   * @param astNode - The MDAST node to check
   * @returns Whether this class can convert the AST node
   */
  canParseAst(astNode: MdastNode): boolean;

  /**
   * Convert from a graph node to an AST node
   * @returns The MDAST representation of this node
   */
  toAst(): MdastNode;
}

/**
 * Helper function to generate a unique ID for an AST node
 * Used for tracking AST to graph node mappings
 */
export function getAstNodeId(astNode: MdastNode): string {
  if (!astNode.position) {
    return `${astNode.type}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  return `${astNode.type}-${astNode.position.start.line}-${astNode.position.start.column}`;
}