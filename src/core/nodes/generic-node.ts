// src/core/nodes/generic-node.ts
import { Node as MdastNode, Paragraph, Text } from 'mdast';
import { ContentNode } from '@/core/node';
import { NodeType } from '@/core/types';
import { ParserContext } from '@/parser/parser-context';
import { generateNodeId } from '@/utils/id-utils';
import { extractInnerText, getAstNodeId } from '@/utils/mdast-utils';

/**
 * Node for generic content that doesn't fit other categories
 */
export class GenericNode extends ContentNode {
  constructor(id: string, content: string, metadata: Record<string, unknown> = {}) {
    super(id, NodeType.Generic, content, metadata);
  }

  /**
   * Convert from an AST node to a generic node
   */
  static fromAst(
    astNode: MdastNode,
    context: ParserContext,
    ancestors: MdastNode[]
  ): GenericNode | null {
    // Skip certain node types that are handled separately or don't need nodes
    if (['root', 'heading', 'list', 'listItem', 'paragraph', 'code', 'text',
      'emphasis', 'strong', 'link', 'inlineCode'].includes(astNode.type)) {
      return null;
    }

    // Create a generic node
    const genericNode = new GenericNode(
      generateNodeId(context.filePath, {
        identifier: `${astNode.type}-${(astNode.position?.start.line ?? 0)}`
      }),
      extractInnerText(astNode, true) || `[${astNode.type}]`,
      {
        nodeType: astNode.type,
        position: astNode.position,
        filePath: context.filePath
      }
    );

    // Add to graph with proper containment
    context.addNodeToGraph(genericNode);

    // Map AST to graph node
    context.mapAstToGraph(astNode, genericNode);

    return genericNode;
  }

  /**
   * Check if this class can parse the given AST node
   * Generic node is a catch-all, but we still skip certain types
   */
  static canParseAst(astNode: MdastNode): boolean {
    return !['root', 'heading', 'list', 'listItem', 'paragraph', 'code', 'text',
      'emphasis', 'strong', 'link', 'inlineCode'].includes(astNode.type);
  }

  /**
   * Convert to an AST node
   */
  toAst(): Paragraph {
    // For generic nodes, we default to a paragraph representation
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