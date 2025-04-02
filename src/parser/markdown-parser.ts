// src/parser/markdown-parser.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { Root, Node, Heading, ListItem, Paragraph, Code } from 'mdast';
import { visitParents, SKIP } from 'unist-util-visit-parents';
import { inspect } from 'unist-util-inspect';

import { CannonballGraph } from '@/core/graph';
import { NodeType, RelationType } from '@/core/types';
import {
  BaseNode,
  ContainerNode,
  NoteNode,
  SectionNode,
  TaskNode,
  BulletNode,
  ParagraphNode,
  CodeBlockNode,
  GenericNode
} from '@/core/node';
import { generateNodeId } from '@/utils/id-utils';
import { extractInnerText, isTaskListItem, calculateIndentLevel, getTaskState } from '@/utils/mdast-utils';
/**
 * Parser that converts Markdown content into a Cannonball graph
 */
export class MarkdownParser {
  /**
   * Parse markdown content into a Cannonball graph
   * @param markdown - The markdown content to parse
   * @param filePath - The file path where the markdown content is located
   * @returns A CannonballGraph representing the markdown content
   */
  parse(markdown: string, filePath: string): CannonballGraph {
    // Parse the markdown into an AST
    const ast = unified().use(remarkParse).parse(markdown);
    console.log(inspect(ast));

    // Create a new graph
    const graph = new CannonballGraph();

    // Process the AST
    this.processAst(ast, graph, filePath);

    // Process relationships between nodes
    this.processRelationships(graph);

    return graph;
  }

  /**
   * Process the Markdown AST and populate the graph
   * @param ast - The Markdown AST root node
   * @param graph - The graph to populate
   * @param filePath - The path of the file being processed
   */
  private processAst(ast: Root, graph: CannonballGraph, filePath: string): void {
    // Create a root node for the file
    const rootNode = new NoteNode(
      generateNodeId(filePath),
      filePath.split('/').pop() || '',
      {
        filePath,
        position: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
      }
    );

    graph.addNode(rootNode);

    // Container stack to track the current context
    // The stack always starts with the root note node
    const containerStack: ContainerNode[] = [rootNode];

    // Create a map to store associations between AST nodes and graph nodes
    const nodeMap = new Map<Node, BaseNode>();

    // Store the root node association
    nodeMap.set(ast, rootNode);

    // Process nodes in document order
    visitParents(ast, (node: Node, ancestors) => {
      let graphNode: BaseNode | null = null;

      // Calculate the current indentation level based on ancestors
      const indentLevel = calculateIndentLevel(node, ancestors);

      switch (node.type) {
        case 'heading':
          graphNode = this.processHeading(node as Heading, filePath, graph, containerStack);
          break;

        case 'list':
          // Lists are containers but don't get direct nodes
          // Their items will be processed individually
          break;

        case 'listItem':
          if (isTaskListItem(node as ListItem)) {
            graphNode = this.processTaskItem(node as ListItem, filePath, graph, containerStack, indentLevel);
          } else {
            graphNode = this.processBulletItem(node as ListItem, filePath, graph, containerStack, indentLevel);
          }
          break;

        case 'paragraph':
          // Only create paragraph nodes for paragraphs not inside listItems
          {
            const parentAst = ancestors[ancestors.length - 1] as Node;
            if (parentAst && parentAst.type !== 'listItem') {
              graphNode = this.processParagraph(node as Paragraph, filePath, graph, containerStack);
            }
          }
          break;

        case 'code':
          graphNode = this.processCodeBlock(node as Code, filePath, graph, containerStack);
          break;

        case 'root':
          // The root node is already handled
          break;

        default:
          // Other node types if they're not already handled as part of another node
          if (!['text', 'emphasis', 'strong', 'link', 'inlineCode'].includes(node.type)) {
            graphNode = this.processGenericNode(node, filePath, graph, containerStack);
          }
          break;
      }

      // Store the association between AST node and graph node
      if (graphNode) {
        nodeMap.set(node, graphNode);
        if (graphNode.type in [NodeType.Section, NodeType.CodeBlock, NodeType.Paragraph]) {
          return SKIP;
        }
      }
    });
  }


  /**
   * Process a heading node and create a section
   */
  private processHeading(
    heading: Heading,
    filePath: string,
    graph: CannonballGraph,
    containerStack: ContainerNode[]
  ): BaseNode {

    // Create the section node
    const headingText = extractInnerText(heading, false);
    const sectionNode = new SectionNode(
      generateNodeId(filePath, { heading: headingText }),
      headingText,
      heading.depth,
      {
        position: heading.position,
        filePath
      }
    );

    graph.addNode(sectionNode);

    // Adjust the container stack - pop containers until finding the right parent
    this.adjustContainerStackForHeading(containerStack, sectionNode);

    // The top of the stack is now the parent container
    const parentContainer = containerStack[containerStack.length - 1];

    // Add containment edge from parent to this section
    graph.addEdge({
      source: parentContainer.id,
      target: sectionNode.id,
      relation: RelationType.ContainsChild,
      metadata: {}
    });

    // Push this section onto the stack
    containerStack.push(sectionNode);

    return sectionNode;
  }

  /**
   * Adjust container stack for heading sections
   */
  private adjustContainerStackForHeading(
    containerStack: ContainerNode[],
    newSection: SectionNode
  ): void {
    // Pop containers until we find an appropriate parent for this section
    while (containerStack.length > 1) {
      const topContainer = containerStack[containerStack.length - 1];

      // If it's a section with a lower or equal level, pop it
      if (!(topContainer instanceof SectionNode) || topContainer.level >= newSection.level) {
        containerStack.pop();
      } else {
        // Found the right parent
        break;
      }
    }
  }

  /**
   * Process a task list item
   */
  private processTaskItem(
    item: ListItem,
    filePath: string,
    graph: CannonballGraph,
    containerStack: ContainerNode[],
    indentLevel: number
  ): BaseNode {
    // Extract content and task state
    const taskState = getTaskState(item);

    // Extract task content
    let content = extractInnerText(item, false);

    // Strip task marker from content
    content = content.replace(/^\s*\[[x ./\-!]\]\s*/, '');

    // Generate a position-based ID for the task
    const listPosition = item.position ?
      `${item.position.start.line}-${item.position.start.column}` :
      `task-${Date.now()}`;

    // Create the task node
    const taskNode = new TaskNode(
      generateNodeId(filePath, { listPosition }),
      content,
      taskState,
      indentLevel,
      {
        position: item.position,
        listPosition,
        filePath
      }
    );

    graph.addNode(taskNode);

    // Adjust the container stack for list nesting
    this.adjustContainerStackForList(containerStack, taskNode);

    // Connect to current container
    const currentContainer = containerStack[containerStack.length - 1];
    graph.addEdge({
      source: currentContainer.id,
      target: taskNode.id,
      relation: RelationType.ContainsChild,
      metadata: {}
    });

    // Push this task onto the container stack
    containerStack.push(taskNode);

    return taskNode;
  }

  /**
   * Process a regular bullet list item
   */
  private processBulletItem(
    item: ListItem,
    filePath: string,
    graph: CannonballGraph,
    containerStack: ContainerNode[],
    indentLevel: number
  ): BaseNode {

    // Generate a position-based ID for the bullet
    const listPosition = item.position ?
      `${item.position.start.line}-${item.position.start.column}` :
      `bullet-${Date.now()}`;

    // Create the bullet node
    const bulletNode = new BulletNode(
      generateNodeId(filePath, { listPosition }),
      extractInnerText(item, false),
      indentLevel,
      {
        position: item.position,
        listPosition,
        filePath
      }
    );

    graph.addNode(bulletNode);

    // Adjust the container stack for list nesting
    this.adjustContainerStackForList(containerStack, bulletNode);

    // Connect to current container
    const currentContainer = containerStack[containerStack.length - 1];
    graph.addEdge({
      source: currentContainer.id,
      target: bulletNode.id,
      relation: RelationType.ContainsChild,
      metadata: {}
    });

    // Push this bullet onto the container stack
    containerStack.push(bulletNode);

    return bulletNode;
  }

  /**
   * Adjust container stack for list items (both bullets and tasks)
   */
  private adjustContainerStackForList(
    containerStack: ContainerNode[],
    newListItem: TaskNode | BulletNode
  ): void {
    // Pop task/bullet containers until we find an appropriate parent
    while (containerStack.length > 1) {
      const topContainer = containerStack[containerStack.length - 1];

      // If it's a task or bullet with greater or equal indent level, pop it
      if ((topContainer instanceof TaskNode || topContainer instanceof BulletNode) &&
        topContainer.indentLevel >= newListItem.indentLevel) {
        containerStack.pop();
      } else {
        // Found the right parent
        break;
      }
    }
  }

  /**
   * Process a paragraph node
   */
  private processParagraph(
    paragraph: Paragraph,
    filePath: string,
    graph: CannonballGraph,
    containerStack: ContainerNode[]
  ): BaseNode {

    // Create node
    const paragraphNode = new ParagraphNode(
      generateNodeId(filePath, {
        identifier: `p-${(paragraph.position?.start.line ?? 0)}`
      }),
      extractInnerText(paragraph, false),
      {
        position: paragraph.position,
        filePath
      }
    );

    graph.addNode(paragraphNode);

    // Connect to current container
    const currentContainer = containerStack[containerStack.length - 1];
    graph.addEdge({
      source: currentContainer.id,
      target: paragraphNode.id,
      relation: RelationType.ContainsChild,
      metadata: {}
    });

    return paragraphNode;
  }

  /**
   * Process a code block
   */
  private processCodeBlock(
    code: Code,
    filePath: string,
    graph: CannonballGraph,
    containerStack: ContainerNode[]
  ): BaseNode {
    // Create node
    const codeNode = new CodeBlockNode(
      generateNodeId(filePath, {
        identifier: `code-${(code.position?.start.line ?? 0)}`
      }),
      code.value,
      code.lang as null | string,
      {
        position: code.position,
        filePath
      }
    );

    graph.addNode(codeNode);

    // Connect to current container
    const currentContainer = containerStack[containerStack.length - 1];
    graph.addEdge({
      source: currentContainer.id,
      target: codeNode.id,
      relation: RelationType.ContainsChild,
      metadata: {}
    });

    return codeNode;
  }

  /**
   * Process a generic AST node
   */
  private processGenericNode(
    node: Node,
    filePath: string,
    graph: CannonballGraph,
    containerStack: ContainerNode[]
  ): BaseNode | null {
    // Skip certain node types that are handled separately
    if (['heading', 'list', 'listItem', 'paragraph', 'text'].includes(node.type)) {
      return null;
    }

    // Create a generic node
    const genericNode = new GenericNode(
      generateNodeId(filePath, {
        identifier: `${node.type}-${(node.position?.start.line ?? 0)}`
      }),
      extractInnerText(node, true) || `[${node.type}]`,
      {
        nodeType: node.type,
        position: node.position,
        filePath
      }
    );

    graph.addNode(genericNode);

    // Connect to current container
    const currentContainer = containerStack[containerStack.length - 1];
    graph.addEdge({
      source: currentContainer.id,
      target: genericNode.id,
      relation: RelationType.ContainsChild,
      metadata: {}
    });

    return genericNode;
  }



  /**
   * Process semantic relationships in the graph
   * This adds relationships beyond the basic containment structure
   */
  private processRelationships(graph: CannonballGraph): void {
    // Process task dependencies based on containment
    this.processTaskDependencies(graph);

    // Process category-based dependencies (tasks in bullets)
    this.processCategoryDependencies(graph);
  }

  /**
   * Process task dependencies based on containment structure
   */
  private processTaskDependencies(graph: CannonballGraph): void {
    // Get all task nodes
    const taskNodes = graph.findNodesByType(NodeType.Task);

    // For each task, create dependencies to its child tasks
    for (const taskNode of taskNodes) {
      const childTasks = graph.getRelatedNodes(taskNode.id, RelationType.ContainsChild)
        .filter(node => node.type === NodeType.Task);

      // Create dependency relationships
      for (const childTask of childTasks) {
        try {
          graph.addEdge({
            source: taskNode.id,
            target: childTask.id,
            relation: RelationType.DependsOn,
            metadata: {}
          });
        } catch {
          // Edge might already exist, that's fine
        }
      }
    }

    // Process deep dependencies (transitive relationships)
    // this.processDeepTaskDependencies(graph);
  }

  /**
   * Process dependencies through bullets/categories
   */
  private processCategoryDependencies(graph: CannonballGraph): void {
    // Find all bullet nodes
    const bulletNodes = graph.findNodesByType(NodeType.Bullet);

    // Process each bullet to ensure proper task dependencies through categories
    for (const bulletNode of bulletNodes) {
      // Get parent task (if any)
      const parentTasks = graph.getRelatingNodes(bulletNode.id, RelationType.ContainsChild)
        .filter(node => node.type === NodeType.Task);

      // Find tasks contained in this bullet
      const containedTasks = this.findNestedTasks(graph, bulletNode);

      // For each parent task, add dependencies to the tasks inside the bullet
      for (const parentTask of parentTasks) {
        for (const childTask of containedTasks) {
          // Avoid circular references
          if (parentTask.id !== childTask.id) {
            // Create dependency relation
            try {
              graph.addEdge({
                source: parentTask.id,
                target: childTask.id,
                relation: RelationType.DependsOn,
                metadata: { throughCategory: true }
              });
            } catch {
              // Edge might already exist, that's fine
            }
          }
        }
      }
    }
  }

  /**
   * Find all tasks nested under a node at any level
   */
  private findNestedTasks(graph: CannonballGraph, node: BaseNode): BaseNode[] {
    const tasks: BaseNode[] = [];

    // Get direct children
    const children = graph.getRelatedNodes(node.id, RelationType.ContainsChild);

    // Check each child
    for (const child of children) {
      if (child.type === NodeType.Task) {
        tasks.push(child);
      }

      // Recursively find tasks in this child
      tasks.push(...this.findNestedTasks(graph, child));
    }

    return tasks;
  }
}