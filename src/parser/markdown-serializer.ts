// src/parser/markdown-serializer.ts
import { toMarkdown } from 'mdast-util-to-markdown';
import { Node as MdastNode, Root, RootContent, List, ListItem } from 'mdast';
import { CannonballGraph } from '@/core/graph';
import { NodeType, RelationType } from '@/core/types';
import { BaseNode } from '@/core/node';
import { AstConvertible } from '@/core/ast-convertible';
import { NoteNode, SectionNode, TaskNode, BulletNode } from '@/core/nodes';

/**
 * Options for serializing the graph to markdown
 */
export interface SerializationOptions {
  /**
   * Whether to split the output into multiple files
   */
  splitIntoFiles?: boolean;

  /**
   * Function to determine the file path for a node
   * If not provided, nodes will be grouped by their original file path
   */
  getFilePath?: (node: BaseNode) => string;

  /**
   * Whether to include metadata inline in the generated markdown
   */
  includeMetadata?: boolean;

  /**
   * Options for the mdast-util-to-markdown library
   */
  markdownOptions?: Record<string, unknown>;
}

/**
 * Result of serializing a graph to markdown
 */
export interface SerializationResult {
  /**
   * Map of file paths to markdown content
   */
  files: Map<string, string>;
}

/**
 * Serializer that converts a Cannonball graph into markdown
 * using mdast-util-to-markdown for the final conversion
 */
export class MarkdownSerializer {
  /**
   * Serialize a Cannonball graph to markdown
   * @param graph - The graph to serialize
   * @param options - Options for serialization
   * @returns The serialization result
   */
  serialize(graph: CannonballGraph, options: SerializationOptions = {}): SerializationResult {
    const result: SerializationResult = {
      files: new Map<string, string>()
    };

    // Group nodes by file
    const nodesByFile = this.groupNodesByFile(graph, options);

    // Process each file
    for (const [filePath, nodes] of nodesByFile) {
      // Convert the graph to an AST
      const ast = this.graphToAst(graph, nodes);

      // Convert the AST to markdown
      const markdown = toMarkdown(ast, {
        bullet: '-',
        listItemIndent: 'one',
        ...options.markdownOptions
      });

      result.files.set(filePath, markdown);
    }

    return result;
  }

  /**
   * Group nodes by the file they belong to
   */
  private groupNodesByFile(
    graph: CannonballGraph,
    options: SerializationOptions
  ): Map<string, BaseNode[]> {
    const nodesByFile = new Map<string, BaseNode[]>();
    const allNodes = graph.getAllNodes();

    for (const node of allNodes) {
      // Determine which file this node belongs to
      let filePath: string;

      if (options.getFilePath) {
        // Use custom function to determine file path
        filePath = options.getFilePath(node);
      } else {
        // Use the node's original file path or derive one
        filePath = node.metadata.filePath as string || 'output.md';
      }

      // Add node to the appropriate file group
      if (!nodesByFile.has(filePath)) {
        nodesByFile.set(filePath, []);
      }
      nodesByFile.get(filePath)!.push(node);
    }

    return nodesByFile;
  }

  /**
   * Convert a set of nodes to an AST
   */
  private graphToAst(graph: CannonballGraph, nodes: BaseNode[]): Root {
    // Create root AST node
    const root: Root = { type: 'root', children: [] };

    // Find top-level nodes (notes and headings without parents)
    const topLevelNodes = this.findTopLevelNodes(graph, nodes);

    // Sort nodes by position in the document
    topLevelNodes.sort((a, b) => {
      const posA = a.metadata.position?.start?.line || 0;
      const posB = b.metadata.position?.start?.line || 0;
      return posA - posB;
    });

    // Process each top-level node
    for (const node of topLevelNodes) {
      if (node instanceof NoteNode) {
        // For notes, add title and process children
        this.processNoteNode(node, graph, root.children);
      } else if (node instanceof SectionNode) {
        // Process headings
        this.processSectionNode(node, graph, root.children);
      }
    }

    return root;
  }

  /**
   * Process a note node
   */
  private processNoteNode(
    node: NoteNode,
    graph: CannonballGraph,
    siblings: RootContent[]
  ): void {
    // Add title as heading if needed
    if (node.content && !node.content.includes('.md')) {
      const astNode = node.toAst() as Root;
      siblings.push(...astNode.children);
    }

    // Process children
    const children = graph.getRelatedNodes(node.id, RelationType.ContainsChild);
    this.processChildNodes(children, graph, siblings);
  }

  /**
   * Process a section (heading) node
   */
  private processSectionNode(
    node: SectionNode,
    graph: CannonballGraph,
    siblings: RootContent[]
  ): void {
    // Add the heading
    const astNode = node.toAst() as RootContent;
    siblings.push(astNode);

    // Process children
    const children = graph.getRelatedNodes(node.id, RelationType.ContainsChild);
    this.processChildNodes(children, graph, siblings);
  }

  /**
   * Process a set of child nodes
   */
  private processChildNodes(
    nodes: BaseNode[],
    graph: CannonballGraph,
    siblings: RootContent[]
  ): void {
    // Group nodes by type for appropriate processing
    const sections: SectionNode[] = [];
    const lists: (TaskNode | BulletNode)[] = [];
    const content: BaseNode[] = [];

    // Sort and categorize nodes
    nodes.sort((a, b) => {
      const posA = a.metadata.position?.start?.line || 0;
      const posB = b.metadata.position?.start?.line || 0;
      return posA - posB;
    });

    for (const node of nodes) {
      if (node instanceof SectionNode) {
        sections.push(node);
      } else if (node instanceof TaskNode || node instanceof BulletNode) {
        lists.push(node);
      } else {
        content.push(node);
      }
    }

    // Process content nodes
    for (const node of content) {
      if ('toAst' in node && typeof (node as AstConvertible).toAst === 'function') {
        const astNode = (node as AstConvertible).toAst() as RootContent;
        siblings.push(astNode);
      }
    }

    // Process list items
    if (lists.length > 0) {
      const listItems = this.processListItems(lists, graph);
      if (listItems.length > 0) {
        const list: List = {
          type: 'list',
          ordered: false,
          spread: false,
          children: listItems
        };
        siblings.push(list);
      }
    }

    // Process section nodes
    for (const node of sections) {
      this.processSectionNode(node, graph, siblings);
    }
  }

  /**
   * Process a set of list items (tasks and bullets)
   */
  private processListItems(
    nodes: (TaskNode | BulletNode)[],
    graph: CannonballGraph
  ): ListItem[] {
    const listItems: ListItem[] = [];

    // Sort by indent level and position
    nodes.sort((a, b) => {
      // First by indent level
      if (a.indentLevel !== b.indentLevel) {
        return a.indentLevel - b.indentLevel;
      }

      // Then by position
      const posA = a.metadata.position?.start?.line || 0;
      const posB = b.metadata.position?.start?.line || 0;
      return posA - posB;
    });

    // Group items by indent level for nested lists
    const itemsByLevel = new Map<number, (TaskNode | BulletNode)[]>();

    for (const node of nodes) {
      if (!itemsByLevel.has(node.indentLevel)) {
        itemsByLevel.set(node.indentLevel, []);
      }
      itemsByLevel.get(node.indentLevel)!.push(node);
    }

    // Start with top-level items
    const topLevelItems = itemsByLevel.get(0) || [];

    for (const node of topLevelItems) {
      const item = node.toAst() as ListItem;

      // Process children of this list item
      const children = graph.getRelatedNodes(node.id, RelationType.ContainsChild);
      const childLists = children.filter(
        child => child instanceof TaskNode || child instanceof BulletNode
      ) as (TaskNode | BulletNode)[];

      // Process other content children
      const contentChildren = children.filter(
        child => !(child instanceof TaskNode || child instanceof BulletNode)
      );

      // Add content children to the list item
      for (const contentNode of contentChildren) {
        if ('toAst' in contentNode && typeof (contentNode as AstConvertible).toAst === 'function') {
          const contentAst = (contentNode as AstConvertible).toAst() as RootContent;
          item.children.push(contentAst);
        }
      }

      // If there are nested list items, add them as a sublist
      if (childLists.length > 0) {
        const nestedItems = this.processListItems(childLists, graph);

        if (nestedItems.length > 0) {
          const nestedList: List = {
            type: 'list',
            ordered: false,
            spread: false,
            children: nestedItems
          };

          item.children.push(nestedList);
        }
      }

      listItems.push(item);
    }

    return listItems;
  }

  /**
   * Find top-level nodes in a document
   * These are notes and headings without parents (or only a note parent)
   */
  private findTopLevelNodes(graph: CannonballGraph, nodes: BaseNode[]): BaseNode[] {
    return nodes.filter(node => {
      if (node.type !== NodeType.Note && node.type !== NodeType.Section) {
        return false;
      }

      const parentNodes = graph.getRelatingNodes(node.id, RelationType.ContainsChild);
      return parentNodes.length === 0 ||
        (parentNodes.length === 1 && parentNodes[0].type === NodeType.Note);
    });
  }
}