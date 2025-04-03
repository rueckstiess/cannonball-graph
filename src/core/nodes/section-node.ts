// src/core/nodes/section-node.ts
import { Heading, Text } from 'mdast';
import { ContainerNode } from '@/core/node';
import { TaskNode, BulletNode } from '@/core/nodes';
import { NodeType } from '@/core/types';
import { ParserContext } from '@/parser/parser-context';
import { generateNodeId } from '@/utils/id-utils';
import { extractInnerText, getAstNodeId } from '@/utils/mdast-utils';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Node representing a section created by a heading
 */
export class SectionNode extends ContainerNode {
  constructor(id: string, title: string, level: HeadingLevel, metadata: Record<string, unknown> = {}) {
    super(id, NodeType.Section, title, {
      ...metadata,
      level
    });
  }

  get level(): HeadingLevel {
    return this.metadata.level as HeadingLevel;
  }

  getContainmentLevel(): HeadingLevel {
    return this.level;
  }

  canContain(node: ContainerNode): boolean {
    // Sections can contain any node type
    // Containment is determined by heading levels in the parser
    return true;
  }

  shouldPopFromContainerStack(newContainer: ContainerNode): boolean {
    // If the new container is a section, compare heading levels
    if (newContainer instanceof SectionNode) {
      return this.level >= newContainer.level;
    }

    if (newContainer instanceof TaskNode || newContainer instanceof BulletNode) {
      return true;
    }

    // Otherwise use default behavior
    return super.shouldPopFromContainerStack(newContainer);
  }

  /**
   * Adjust the container stack specifically for heading sections
   */
  adjustContainerStack(context: ParserContext): void {
    // Pop containers until we find an appropriate parent for this section
    while (context.containerStack.length > 1) {
      const topContainer = context.containerStack[context.containerStack.length - 1];

      // If it's a section with a lower or equal level, pop it
      if (!(topContainer instanceof SectionNode) || topContainer.level >= this.level) {
        context.containerStack.pop();
      } else {
        // Found the right parent
        break;
      }
    }
  }

  /**
   * Convert from an AST heading node to a section node
   */
  static fromAst(
    astNode: Heading,
    context: ParserContext,
    ancestors: Heading[]
  ): SectionNode | null {
    if (astNode.type !== 'heading') return null;

    // Extract heading text
    const headingText = extractInnerText(astNode, true);

    // Create a section node
    const sectionNode = new SectionNode(
      generateNodeId(context.filePath, { heading: headingText }),
      headingText,
      astNode.depth,
      {
        position: astNode.position,
        filePath: context.filePath
      }
    );

    // Adjust the container stack to find the right parent
    sectionNode.adjustContainerStack(context);

    // Add to graph with proper containment
    context.addNodeToGraph(sectionNode);

    // Push this section onto the stack
    context.containerStack.push(sectionNode);

    // Map AST to graph node
    context.mapAstToGraph(astNode, sectionNode);

    return sectionNode;
  }

  /**
   * Check if this class can parse the given AST node
   */
  static canParseAst(astNode: Heading): boolean {
    return astNode.type === 'heading';
  }

  /**
   * Convert to an AST node
   */
  toAst(): Heading {
    const textNode: Text = {
      type: 'text',
      value: this.content
    };

    return {
      type: 'heading',
      depth: this.level,
      children: [textNode]
    };
  }
}