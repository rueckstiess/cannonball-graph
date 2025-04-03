// src/core/nodes/note-node.ts
import { Root, RootContent, Heading, Text } from 'mdast';
import { ContainerNode } from '@/core/node';
import { NodeType } from '@/core/types';
import { ParserContext } from '@/parser/parser-context';
import { generateNodeId } from '@/utils/id-utils';
import { getAstNodeId } from '@/utils/mdast-utils';

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

  canContain(node: ContainerNode): boolean {
    // Notes can contain any node type except other notes
    return node.type !== NodeType.Note;
  }

  /**
   * Convert from an AST root node to a note node
   */
  static fromAst(
    astNode: Root,
    context: ParserContext,
    ancestors: Root[]
  ): NoteNode | null {
    if (astNode.type !== 'root') return null;

    // Create a note node for the document
    const title = context.filePath.split('/').pop() || '';
    const noteNode = new NoteNode(
      generateNodeId(context.filePath),
      title,
      {
        filePath: context.filePath,
        position: astNode.position || { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
      }
    );

    // Add to graph
    context.graph.addNode(noteNode);

    // Map AST to graph node
    context.mapAstToGraph(astNode, noteNode);

    return noteNode;
  }

  /**
   * Check if this class can parse the given AST node
   */
  static canParseAst(astNode: Root): boolean {
    return astNode.type === 'root';
  }

  /**
   * Convert to an AST node
   */
  toAst(): Root {
    const children: RootContent[] = [];

    // Add title as a heading if it's not the filename
    if (this.content && !this.content.includes('.md')) {
      const titleTextNode: Text = {
        type: 'text',
        value: this.content
      };

      const titleHeading: Heading = {
        type: 'heading',
        depth: 1,
        children: [titleTextNode]
      };

      children.push(titleHeading);
    }

    return {
      type: 'root',
      children
    };
  }
}