// src/core/nodes/paragraph-node.ts
import { Paragraph, Text, Node } from 'mdast';
import { ContentNode } from '@/core/node';
import { NodeType } from '@/core/types';
import { ParserContext } from '@/parser/parser-context';
import { generateNodeId } from '@/utils/id-utils';
import { extractInnerText, getAstNodeId } from '@/utils/mdast-utils';


/**
 * Node representing a paragraph of text
 */
export class ParagraphNode extends ContentNode {
  constructor(id: string, content: string, metadata: Record<string, unknown> = {}) {
    super(id, NodeType.Paragraph, content, metadata);
  }

  /**
   * Convert from an AST paragraph node to a paragraph node
   */
  static fromAst(
    astNode: Paragraph,
    context: ParserContext,
    ancestors: Node[]
  ): ParagraphNode | null {
    if (astNode.type !== 'paragraph') return null;

    // Check if this paragraph is inside a list item
    // If so, we don't create a separate paragraph node, as the content
    // becomes part of the list item node
    const parentAst = ancestors[ancestors.length - 1];
    if (parentAst && parentAst.type === 'listItem') {
      return null;
    }

    // Extract paragraph content
    const content = extractInnerText(astNode, true);

    // Create the paragraph node
    const paragraphNode = new ParagraphNode(
      generateNodeId(context.filePath, {
        identifier: `p-${(astNode.position?.start.line ?? 0)}`
      }),
      content,
      {
        position: astNode.position,
        filePath: context.filePath
      }
    );

    // Add to graph with proper containment
    context.addNodeToGraph(paragraphNode);

    // Map AST to graph node
    context.mapAstToGraph(astNode, paragraphNode);

    return paragraphNode;
  }

  /**
   * Check if this class can parse the given AST node
   */
  static canParseAst(astNode: Paragraph): boolean {
    return astNode.type === 'paragraph';
  }

  /**
   * Convert to an AST node
   */
  toAst(): Paragraph {
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