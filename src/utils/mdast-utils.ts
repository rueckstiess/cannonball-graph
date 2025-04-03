import { Node, Text, ListItem } from 'mdast';
import { visit, EXIT } from 'unist-util-visit';
import { TaskState } from '@/core/types';

/**
 * 
 * @param node mdast Node to parse
 * @param recursive whether to traverse child nodes after the first text node
 * @returns the first inner text of a node (recursive = false) or all inner text concatenated (recursive = true)
 */
export function extractInnerText(node: Node, recursive: boolean = true): string {
  let content = '';
  visit(node, 'text', (textNode: Text) => {
    content += textNode.value;
    if (!recursive) {
      return EXIT;
    }
  });
  return content;
}


/**
 * Check if a list item is a task item
 * TODO replace with remark-custom-tasks plugin
 */
export function isTaskListItem(item: ListItem): boolean {
  const textContent = extractInnerText(item, false);
  return textContent.match(/^\s*\[[x ./\-!]\]\s*/) !== null;
}


/**
 * Calculate the indent level of a node based on its ancestors
 */
export function calculateIndentLevel(node: Node, ancestors: Node[]): number {
  if (node.type !== 'listItem') return 0;

  // Count the number of nested list items
  return ancestors.filter(ancestor => ancestor.type === 'listItem').length;
}


/**
 * Get the state of a task list item
 */
export function getTaskState(item: ListItem): TaskState {
  let state = TaskState.Open;

  const textContent = extractInnerText(item, false);

  const match = textContent.match(/^\s*\[([x ./\-!])\]\s*/);
  if (match) {
    switch (match[1]) {
      case 'x':
        state = TaskState.Complete;
        break;
      case '/':
        state = TaskState.InProgress;
        break;
      case '-':
        state = TaskState.Cancelled;
        break;
      case '!':
        state = TaskState.Blocked;
        break;
      default:
        state = TaskState.Open;
    }
  }

  return state;
}


/**
 * Helper function to generate a unique ID for an AST node
 * Used for tracking AST to graph node mappings
 */
export function getAstNodeId(astNode: Node): string {
  if (!astNode.position) {
    return `${astNode.type}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  return `${astNode.type}-${astNode.position.start.line}-${astNode.position.start.column}`;
}