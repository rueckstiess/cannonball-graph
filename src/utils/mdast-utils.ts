import { Node, Text } from 'mdast';
import { visit, EXIT } from 'unist-util-visit';


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