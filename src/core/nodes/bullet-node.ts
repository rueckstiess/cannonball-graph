// src/core/nodes/bullet-node.ts
import { ListItem, Paragraph, Text } from 'mdast';
import { ContainerNode, TaskNode } from '@/core/node';
import { NodeType } from '@/core/types';
import { AstConvertible, getAstNodeId } from '@/core/ast-convertible';
import { ParserContext } from '@/parser/parser-context';
import { generateNodeId } from '@/utils/id-utils';
import {
  extractInnerText,
  isTaskListItem,
  calculateIndentLevel
} from '@/utils/mdast-utils';

/**
 * Node representing a bullet list item
 */
export class BulletNode extends ContainerNode implements AstConvertible {
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

  canContain(node: ContainerNode): boolean {
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

  /**
   * Adjust the container stack specifically for bullets
   */
  adjustContainerStack(context: ParserContext): void {
    // Pop containers until we find an appropriate parent
    while (context.containerStack.length > 1) {
      const topContainer = context.containerStack[context.containerStack.length - 1];

      // If it's a task or bullet with greater or equal indent level, pop it
      if ((topContainer instanceof TaskNode || topContainer instanceof BulletNode) &&
        topContainer.indentLevel >= this.indentLevel) {
        context.containerStack.pop();
      } else {
        // Found the right parent
        break;
      }
    }
  }

  /**
   * Convert from an AST list item node to a bullet node
   */
  static fromAst(
    astNode: ListItem,
    context: ParserContext,
    ancestors: ListItem[]
  ): BulletNode | null {
    // Only process non-task list items
    if (astNode.type !== 'listItem' || isTaskListItem(astNode)) {
      return null;
    }

    // Extract bullet content
    const content = extractInnerText(astNode, false);

    // Calculate indent level based on ancestors
    const indentLevel = calculateIndentLevel(astNode, ancestors);

    // Generate a position-based ID for the bullet
    const listPosition = astNode.position ?
      `${astNode.position.start.line}-${astNode.position.start.column}` :
      `bullet-${Date.now()}`;

    // Create the bullet node
    const bulletNode = new BulletNode(
      generateNodeId(context.filePath, { listPosition }),
      content,
      indentLevel,
      {
        position: astNode.position,
        listPosition,
        filePath: context.filePath
      }
    );

    // Adjust the container stack to find the right parent
    bulletNode.adjustContainerStack(context);

    // Add to graph with proper containment
    context.addNodeToGraph(bulletNode);

    // Push this bullet onto the stack
    context.containerStack.push(bulletNode);

    // Map AST to graph node
    context.mapAstToGraph(astNode, bulletNode);

    return bulletNode;
  }

  /**
   * Check if this class can parse the given AST node
   */
  static canParseAst(astNode: ListItem): boolean {
    return astNode.type === 'listItem' && !isTaskListItem(astNode);
  }

  /**
   * Convert to an AST node
   */
  toAst(): ListItem {
    // Create the content text
    const contentText: Text = {
      type: 'text',
      value: this.content
    };

    // Create a paragraph with the content
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [contentText]
    };

    // Create the list item
    return {
      type: 'listItem',
      children: [paragraph]
    };
  }
}