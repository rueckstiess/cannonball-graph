// src/parser/markdown-serializer.ts
import { toMarkdown } from 'mdast-util-to-markdown';
import { Root, List, Node as mdastNode, Code } from 'mdast';

import { CannonballGraph } from '@/core/graph';
import { BaseNode } from '@/core/node';
import { NodeType, RelationType } from '@/core/types';
import { BulletNode, TaskNode, SectionNode, NoteNode, CodeBlockNode, GenericNode, ParagraphNode } from '@/core/nodes';

/**
 * Options for markdown serialization
 */
export interface SerializationOptions {
  /** Root node ID to start serialization from (optional) */
  rootId?: string;
  /** Options to pass to mdast-util-to-markdown */
  markdownOptions?: Parameters<typeof toMarkdown>[1];
}

/**
 * Result of serialization process
 */
export interface SerializationResult {
  /** The markdown text */
  markdown: string;
  /** The mdast root node */
  ast: Root;
  /** Nodes that were serialized */
  serializedNodes: BaseNode[];
}

/**
 * Class for serializing a Cannonball graph back to Markdown
 */
export class MarkdownSerializer {
  private graph: CannonballGraph;
  private visitedNodes: Set<string>;
  private serializedNodes: BaseNode[];

  constructor(graph: CannonballGraph) {
    this.graph = graph;
    this.visitedNodes = new Set<string>();
    this.serializedNodes = [];
  }

  /**
   * Serialize the graph to Markdown
   * @param options - Serialization options
   * @returns The serialization result
   */
  serialize(options: SerializationOptions = {}): SerializationResult {
    this.visitedNodes.clear();
    this.serializedNodes = [];

    // Create the root of the MDAST
    const rootAst: Root = {
      type: 'root',
      children: []
    };

    // Find the starting nodes for serialization
    let startNodes: BaseNode[];
    if (options.rootId) {
      // If a specific root ID is provided, start from that node
      const rootNode = this.graph.getNode(options.rootId) as BaseNode;
      if (!rootNode) {
        throw new Error(`Root node with ID ${options.rootId} not found`);
      }
      startNodes = [rootNode];
    } else {
      // Otherwise, find all nodes without incoming "contains" edges
      startNodes = this.findRootNodes();
    }

    // Process each start node
    for (const node of startNodes) {
      this.processNode(node, rootAst.children);
    }

    // Convert the AST to Markdown
    const markdown = toMarkdown(rootAst, options.markdownOptions);

    return {
      markdown,
      ast: rootAst,
      serializedNodes: this.serializedNodes
    };
  }

  /**
   * Find all nodes in the graph without incoming "contains" edges
   * @returns Array of root nodes
   */
  private findRootNodes(): BaseNode[] {
    const allNodes = this.graph.getAllNodes();
    return allNodes.filter(node => {
      const containingNodes = this.graph.getRelatingNodes(node.id, RelationType.ContainsChild) as BaseNode[];
      return containingNodes.length === 0;
    });
  }

  /**
   * Process a node and its children recursively
   * @param node - The node to process
   * @param astChildren - The array to add the resulting AST nodes to
   */
  private processNode(node: BaseNode, astChildren: mdastNode[]): void {
    // Skip if we've already visited this node
    if (this.visitedNodes.has(node.id)) {
      return;
    }

    this.visitedNodes.add(node.id);
    this.serializedNodes.push(node);

    // Handle different node types
    if (node.type === NodeType.Note) {
      this.processNoteNode(node as NoteNode, astChildren as mdastNode[]);
    } else if (node.type === NodeType.Section) {
      this.processSectionNode(node as SectionNode, astChildren as mdastNode[]);
    } else if (node.type === NodeType.Task || node.type === NodeType.Bullet) {
      this.processListNode(node as TaskNode | BulletNode, astChildren as mdastNode[]);
    } else {
      // For other node types, just convert to AST and add
      const astNode = node.toAst();
      astChildren.push(astNode as mdastNode);

      // Process children
      this.processChildren(node, astChildren);
    }
  }

  /**
   * Process a note node
   * @param node - The note node
   * @param astChildren - The array to add the resulting AST nodes to
   */
  private processNoteNode(node: NoteNode, astChildren: mdastNode[]): void {
    // Convert to AST
    const astNode = node.toAst();

    // Add the title heading if it exists
    if (astNode.children.length > 0) {
      astChildren.push(...astNode.children);
    }

    // Process children
    this.processChildren(node, astChildren);
  }

  /**
   * Process a section node
   * @param node - The section node
   * @param astChildren - The array to add the resulting AST nodes to
   */
  private processSectionNode(node: SectionNode, astChildren: mdastNode[]): void {
    // Convert to AST
    const astNode = node.toAst();

    // Add the heading
    astChildren.push(astNode);

    // Process children - for sections, add as siblings not children
    this.processChildren(node, astChildren);
  }

  /**
   * Process a list node (task or bullet)
   * @param node - The list node
   * @param astChildren - The array to add the resulting AST nodes to
   */
  private processListNode(node: TaskNode | BulletNode, astChildren: mdastNode[]): void {
    // Find any existing list to add to
    let list = this.findOrCreateList(astChildren);

    // Convert to AST
    const listItemAst = node.toAst();

    // Add to list
    list.children.push(listItemAst);

    // For list item children, we need to handle them specially
    const children = this.graph.getRelatedNodes(node.id, RelationType.ContainsChild);

    // First, group children by type
    const listChildren: (TaskNode | BulletNode)[] = [];
    const otherChildren: BaseNode[] = [];

    for (const child of children) {
      if (child.type === NodeType.Task || child.type === NodeType.Bullet) {
        listChildren.push(child as TaskNode | BulletNode);
      } else {
        otherChildren.push(child);
      }
    }

    // Process list children - they need to be added to the list item's children
    if (listChildren.length > 0) {
      // Create a sublist for nested list items
      const subList: List = {
        type: 'list',
        children: []
      };

      // If the first child is a task, make it an ordered list
      if (listChildren[0].type === NodeType.Task) {
        subList.ordered = false;
      }

      // Add the sublist to the list item
      listItemAst.children.push(subList);

      // Process each list child
      for (const listChild of listChildren) {
        this.visitedNodes.add(listChild.id);
        this.serializedNodes.push(listChild);

        // Add the list item to the sublist
        const childListItemAst = listChild.toAst();
        subList.children.push(childListItemAst);

        // Recursively process its children
        this.processListItemChildren(listChild, childListItemAst);
      }
    }

    // Process other children normally
    for (const child of otherChildren) {
      // Skip if we've already visited this node
      if (this.visitedNodes.has(child.id)) {
        continue;
      }

      this.visitedNodes.add(child.id);
      this.serializedNodes.push(child);

      // Convert to AST
      const childAst = child.toAst();

      // Add to list item children
      listItemAst.children.push(childAst);

      // Process its children
      this.processChildren(child, listItemAst.children as mdastNode[]);
    }
  }

  /**
   * Process children of a list item recursively
   * @param node - The list item node
   * @param listItemAst - The list item AST node
   */
  private processListItemChildren(node: TaskNode | BulletNode, listItemAst: any): void {
    const children = this.graph.getRelatedNodes(node.id, RelationType.ContainsChild);

    // Group children by type
    const listChildren: (TaskNode | BulletNode)[] = [];
    const otherChildren: BaseNode[] = [];

    for (const child of children) {
      if (child.type === NodeType.Task || child.type === NodeType.Bullet) {
        listChildren.push(child as TaskNode | BulletNode);
      } else {
        otherChildren.push(child);
      }
    }

    // Process list children - they need to be added to the list item's children
    if (listChildren.length > 0) {
      // Create a sublist for nested list items
      const subList: List = {
        type: 'list',
        children: []
      };

      // If the first child is a task, make it an ordered list
      if (listChildren[0].type === NodeType.Task) {
        subList.ordered = false;
      }

      // Add the sublist to the list item
      listItemAst.children.push(subList);

      // Process each list child
      for (const listChild of listChildren) {
        this.visitedNodes.add(listChild.id);
        this.serializedNodes.push(listChild);

        // Add the list item to the sublist
        const childListItemAst = listChild.toAst();
        subList.children.push(childListItemAst);

        // Recursively process its children
        this.processListItemChildren(listChild, childListItemAst);
      }
    }

    // Process other children normally
    for (const child of otherChildren) {
      // Skip if we've already visited this node
      if (this.visitedNodes.has(child.id)) {
        continue;
      }

      this.visitedNodes.add(child.id);
      this.serializedNodes.push(child);

      // Convert to AST
      const childAst = child.toAst();

      // Add to list item children
      listItemAst.children.push(childAst);
    }
  }

  /**
   * Process children of a node
   * @param node - The parent node
   * @param astChildren - The array to add the resulting AST nodes to
   */
  private processChildren(node: BaseNode, astChildren: mdastNode[]): void {
    const children = this.graph.getRelatedNodes(node.id, RelationType.ContainsChild);

    for (const child of children) {
      // Skip if we've already visited this node
      if (this.visitedNodes.has(child.id)) {
        continue;
      }

      this.processNode(child, astChildren);
    }
  }

  /**
   * Find an existing list in the AST children, or create a new one
   * @param astChildren - The array to search in
   * @returns The list AST node
   */
  private findOrCreateList(astChildren: mdastNode[]): List {
    // Look for an existing list at the end of the children
    const lastChild = astChildren[astChildren.length - 1];
    if (lastChild && lastChild.type === 'list') {
      return lastChild as List;
    }

    // Create a new list
    const list: List = {
      type: 'list',
      children: []
    };

    // Add to children
    astChildren.push(list);

    return list;
  }
}