// src/core/nodes/code-block-node.ts
import { Code } from 'mdast';
import { ContentNode } from '@/core/node';
import { NodeType } from '@/core/types';
import { ParserContext } from '@/parser/parser-context';
import { generateNodeId } from '@/utils/id-utils';

/**
 * Node representing a code block
 */
export class CodeBlockNode extends ContentNode {
  constructor(
    id: string,
    content: string,
    language: string | null | undefined,
    metadata: Record<string, unknown> = {}
  ) {
    super(id, NodeType.CodeBlock, content, {
      ...metadata,
      language
    });
  }

  get language(): string | null {
    return this.metadata.language as string || null;
  }

  /**
   * Convert from an AST code node to a code block node
   */
  static fromAst(
    astNode: Code,
    context: ParserContext,
    ancestors: Code[]
  ): CodeBlockNode | null {
    if (astNode.type !== 'code') return null;

    // Create the code block node
    const codeNode = new CodeBlockNode(
      generateNodeId(context.filePath, {
        identifier: `code-${(astNode.position?.start.line ?? 0)}`
      }),
      astNode.value,
      astNode.lang,
      {
        position: astNode.position,
        filePath: context.filePath
      }
    );

    // Add to graph with proper containment
    context.addNodeToGraph(codeNode);

    // Map AST to graph node
    context.mapAstToGraph(astNode, codeNode);

    return codeNode;
  }

  /**
   * Check if this class can parse the given AST node
   */
  static canParseAst(astNode: Code): boolean {
    return astNode.type === 'code';
  }

  /**
   * Convert to an AST node
   */
  toAst(): Code {
    return {
      type: 'code',
      value: this.content,
      lang: this.language
    };
  }
}