// src/parser/markdown-parser.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { Root, Node, Heading, ListItem, Paragraph, Text, Code } from 'mdast';
import { visit } from 'unist-util-visit';
import { visitParents, SKIP, EXIT } from 'unist-util-visit-parents';
import { CannonballGraph } from '../core/graph';
import { NodeType, RelationType, TaskState } from '../core/types';
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
} from '../core/node';
import { generateNodeId } from '../utils/id-utils';

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
      const indentLevel = this.calculateIndentLevel(node, ancestors);

      switch (node.type) {
        case 'heading':
          graphNode = this.processHeading(node as Heading, filePath, graph, containerStack);
          break;

        case 'list':
          // Lists are containers but don't get direct nodes
          // Their items will be processed individually
          break;

        case 'listItem':
          if (this.isTaskListItem(node as ListItem)) {
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
        if (graphNode.type === NodeType.Section ||
          graphNode.type === NodeType.CodeBlock ||
          graphNode.type === NodeType.Paragraph) {
          return SKIP;
        }
      }
    });
  }

  /**
   * Calculate the indent level of a node based on its ancestors
   */
  private calculateIndentLevel(node: Node, ancestors: Node[]): number {
    if (node.type !== 'listItem') return 0;

    // Count the number of nested list items
    let level = 0;
    for (const ancestor of ancestors) {
      if (ancestor.type === 'listItem') {
        level++;
      }
    }
    return level;
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
    // Extract heading text
    let headingText = '';
    visit(heading, 'text', (textNode: Text) => {
      headingText += textNode.value;
    });

    // Create the section node
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
    const taskState = this.getTaskState(item);

    // Extract task content
    let content = '';
    visit(item, 'text', (textNode: Text) => {
      content += textNode.value;
      return EXIT;
    });

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
    // Extract bullet content
    let content = '';
    visit(item, 'text', (textNode: Text) => {
      content += textNode.value;
    });

    // Generate a position-based ID for the bullet
    const listPosition = item.position ?
      `${item.position.start.line}-${item.position.start.column}` :
      `bullet-${Date.now()}`;

    // Create the bullet node
    const bulletNode = new BulletNode(
      generateNodeId(filePath, { listPosition }),
      content,
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
    // Extract text
    let content = '';
    visit(paragraph, 'text', (textNode: Text) => {
      content += textNode.value;
    });

    // Create node
    const paragraphNode = new ParagraphNode(
      generateNodeId(filePath, {
        identifier: `p-${(paragraph.position?.start.line ?? 0)}`
      }),
      content,
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
      this.extractNodeContent(node),
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
   * Extract content from an arbitrary AST node
   */
  private extractNodeContent(node: Node): string {
    if ('value' in node && typeof node.value === 'string') {
      return node.value;
    }

    let content = '';
    visit(node, 'text', (textNode: Text) => {
      content += textNode.value;
    });

    return content || `[${node.type}]`;
  }

  /**
   * Check if a list item is a task item
   */
  private isTaskListItem(item: ListItem): boolean {
    let isTask = false;

    visit(item, 'text', (textNode: Text) => {
      if (textNode.value.match(/^\s*\[[x ./\-!]\]\s*/)) {
        isTask = true;
      }
    });

    return isTask;
  }

  /**
   * Get the state of a task list item
   */
  private getTaskState(item: ListItem): TaskState {
    let state = TaskState.Open;

    visit(item, 'text', (textNode: Text) => {
      const match = textNode.value.match(/^\s*\[([x ./\-!])\]\s*/);
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
      return EXIT;
    });

    return state;
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
        } catch (error) {
          // Edge might already exist, that's fine
        }
      }
    }

    // Process deep dependencies (transitive relationships)
    this.processDeepTaskDependencies(graph);
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
            } catch (error) {
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

  /**
   * Process task dependencies that span multiple levels
   * This ensures that a task depends on all subtasks at any level of nesting
   */
  private processDeepTaskDependencies(graph: CannonballGraph): void {
    // Get all task nodes
    const taskNodes = graph.findNodesByType(NodeType.Task);

    // For each task, find all descendant tasks and create dependencies
    for (const task of taskNodes) {
      // See if this task already has dependencies
      const directDependencies = graph.getRelatedNodes(task.id, RelationType.DependsOn);

      // If it has no dependencies, no need to process further
      if (directDependencies.length === 0) {
        continue;
      }

      // Process each direct dependency to find deeper dependencies
      for (const dependency of directDependencies) {
        if (dependency.type === NodeType.Task) {
          // Find all tasks that this dependency depends on
          const deeperDependencies = graph.getRelatedNodes(dependency.id, RelationType.DependsOn);

          // Create direct dependencies to these deeper tasks
          for (const deepDependency of deeperDependencies) {
            if (deepDependency.id !== task.id) {
              try {
                graph.addEdge({
                  source: task.id,
                  target: deepDependency.id,
                  relation: RelationType.DependsOn,
                  metadata: { transitive: true }
                });
              } catch (error) {
                // Edge might already exist, that's fine
              }
            }
          }
        }
      }
    }
  }
}