// src/core/nodes/task-node.ts
import { ListItem, Paragraph, Text } from 'mdast';
import { ContainerNode, BulletNode, SectionNode } from '@/core';
import { NodeType, TaskState } from '@/core/types';
import { ParserContext } from '@/parser/parser-context';
import { generateNodeId } from '@/utils/id-utils';
import {
  extractInnerText,
  isTaskListItem,
  calculateIndentLevel,
  getTaskState,
  getAstNodeId
} from '@/utils/mdast-utils';

/**
 * Node representing a task item with a state
 */
export class TaskNode extends ContainerNode {
  constructor(
    id: string,
    content: string,
    state: TaskState = TaskState.Open,
    indentLevel: number = 0,
    metadata: Record<string, unknown> = {}
  ) {
    super(id, NodeType.Task, content, {
      ...metadata,
      taskState: state,
      indentLevel
    });
  }

  get state(): TaskState {
    return this.metadata.taskState as TaskState;
  }

  get indentLevel(): number {
    return this.metadata.indentLevel as number || 0;
  }

  getContainmentLevel(): number {
    return this.indentLevel;
  }

  canContain(node: ContainerNode): boolean {
    // Tasks can contain other tasks, bullets, or content nodes
    return true;
  }

  shouldPopFromContainerStack(newContainer: ContainerNode): boolean {
    // If dealing with nested list items (tasks or bullets)
    if (newContainer instanceof TaskNode || newContainer instanceof BulletNode) {
      return this.indentLevel >= newContainer.indentLevel;
    }

    if (newContainer instanceof SectionNode) {
      return true;
    }

    // For other containers, use default behavior
    return super.shouldPopFromContainerStack(newContainer);
  }

  /**
   * Adjust the container stack specifically for tasks
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
   * Convert from an AST list item node to a task node
   */
  static fromAst(
    astNode: ListItem,
    context: ParserContext,
    ancestors: ListItem[]
  ): TaskNode | null {
    if (astNode.type !== 'listItem' || !isTaskListItem(astNode)) {
      return null;
    }

    // Extract task state
    const taskState = getTaskState(astNode);

    // Extract task content
    let content = extractInnerText(astNode, false);

    // Strip task marker from content
    content = content.replace(/^\s*\[[x ./\-!]\]\s*/, '');

    // Calculate indent level based on ancestors
    const indentLevel = calculateIndentLevel(astNode, ancestors);

    // Generate a position-based ID for the task, or use a hash of the content
    const listPosition = astNode.position ?
      `${astNode.position.start.line}-${astNode.position.start.column}` :
      getAstNodeId(astNode);

    // Create the task node
    const taskNode = new TaskNode(
      generateNodeId(context.filePath, { listPosition }),
      content,
      taskState,
      indentLevel,
      {
        position: astNode.position,
        listPosition,
        filePath: context.filePath
      }
    );

    // Adjust the container stack to find the right parent
    taskNode.adjustContainerStack(context);

    // Add to graph with proper containment
    context.addNodeToGraph(taskNode);

    // Push this task onto the stack
    context.containerStack.push(taskNode);

    // Map AST to graph node
    context.mapAstToGraph(astNode, taskNode);

    return taskNode;
  }

  /**
   * Check if this class can parse the given AST node
   */
  static canParseAst(astNode: ListItem): boolean {
    return astNode.type === 'listItem' && isTaskListItem(astNode);
  }

  /**
   * Convert to an AST node
   */
  toAst(): ListItem {

    // Create the content text
    const contentText: Text = {
      type: 'text',
      value: `[${this.getTaskStateMarker()}] ${this.content}`
    };

    // Create a paragraph with the checkbox and content
    const paragraph: Paragraph = {
      type: 'paragraph',
      children: [contentText]
    };

    // Create the list item
    return {
      type: 'listItem',
      spread: false,
      children: [paragraph],
      checked: this.state === TaskState.Complete
    };
  }

  /**
   * Get the marker character for a task state
   */
  private getTaskStateMarker(): string {
    switch (this.state) {
      case TaskState.Complete:
        return 'x';
      case TaskState.InProgress:
        return '/';
      case TaskState.Blocked:
        return '!';
      case TaskState.Cancelled:
        return '-';
      case TaskState.Open:
      default:
        return ' ';
    }
  }
}