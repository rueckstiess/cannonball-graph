// src/parser/markdown-parser.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { Root, Node, Heading, ListItem, Paragraph, Text, Code } from 'mdast';
import { visit } from 'unist-util-visit';
import { visitParents, SKIP } from 'unist-util-visit-parents';
import { CannonballGraph } from '../core/graph';
import { NodeType, RelationType, Node as GraphNode, TaskState } from '../core/types';
import { generateNodeId } from '../utils/id-utils';
import { inspect } from 'unist-util-inspect';
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

    // Generate relationships between nodes
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
    const rootNode: GraphNode = {
      id: generateNodeId(filePath),
      type: NodeType.Note,
      content: filePath.split('/').pop() || '',
      metadata: {
        filePath,
        position: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
      },
      createdDate: new Date(),
      modifiedDate: new Date(),
    };

    graph.addNode(rootNode);

    // Create a map to store associations between AST nodes and graph nodes
    const nodeMap = new Map<Node, GraphNode>();

    // Store the root node association
    nodeMap.set(ast, rootNode);

    // First pass: Create all nodes
    visitParents(ast, (node: Node, ancestors) => {
      let graphNode: GraphNode | null = null;

      switch (node.type) {
        case 'heading':
          graphNode = this.processHeading(node as Heading, filePath, graph, rootNode.id);
          break;

        case 'list':
          // Lists are containers but don't get direct nodes
          // Their items will be processed individually
          break;

        case 'listItem':
          if (this.isTaskListItem(node as ListItem)) {
            graphNode = this.processTaskItem(node as ListItem, filePath, graph);
          } else {
            graphNode = this.processBulletItem(node as ListItem, filePath, graph);
          }
          break;

        case 'paragraph':
          // Only create paragraph nodes for top-level paragraphs
          // (not inside listItems, where they're just the content)
          {
            const parentAst = ancestors[ancestors.length - 1] as Node;
            if (parentAst && parentAst.type !== 'listItem') {
              graphNode = this.processParagraph(node as Paragraph, filePath, graph);
            }
          }
          break;

        case 'code':
          graphNode = this.processCode(node as Code, filePath, graph);
          break;

        case 'root':
          // The root node is already handled
          break;

        default:
          // Other node types if they're not already handled as part of another node
          if (!['text', 'emphasis', 'strong', 'link', 'inlineCode'].includes(node.type)) {
            graphNode = this.processGenericNode(node, filePath, graph);
          }
          break;
      }

      // Store the association between AST node and graph node
      if (graphNode) {
        nodeMap.set(node, graphNode);
        return SKIP;
      }
    });

    // Second pass: Create relationships
    visitParents(ast, (node: Node, ancestors) => {
      // Skip nodes that don't have graph representations
      if (!nodeMap.has(node)) {
        return;
      }

      const graphNode = nodeMap.get(node)!;

      // Find the parent node in the graph
      let parentNode: GraphNode | undefined;

      // Look through ancestors in reverse order to find the nearest ancestor with a graph node
      for (let i = ancestors.length - 1; i >= 0; i--) {
        const ancestor = ancestors[i];
        if (nodeMap.has(ancestor)) {
          parentNode = nodeMap.get(ancestor);
          break;
        }
      }

      // If we found a parent, create the relationship
      if (parentNode && parentNode.id !== graphNode.id) {
        // Determine the relationship type based on node types
        const relationType = RelationType.ContainsChild;

        // Special relationship for tasks within tasks
        if (parentNode.type === NodeType.Task && graphNode.type === NodeType.Task) {
          // Task hierarchy: parent depends on children
          graph.addEdge({
            source: parentNode.id,
            target: graphNode.id,
            relation: RelationType.DependsOn,
            metadata: {}
          });
        }

        // Add the containment relationship
        graph.addEdge({
          source: parentNode.id,
          target: graphNode.id,
          relation: relationType,
          metadata: {}
        });
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parentId: string
  ): GraphNode {
    // Extract heading text
    let headingText = '';
    visit(heading, 'text', (textNode: Text) => {
      headingText += textNode.value;
    });

    // Create the section node
    const node: GraphNode = {
      id: generateNodeId(filePath, { heading: headingText }),
      type: NodeType.Section,
      content: headingText,
      metadata: {
        level: heading.depth,
        position: heading.position,
        filePath
      },
      createdDate: new Date(),
      modifiedDate: new Date(),
    };

    graph.addNode(node);

    return node;
  }

  /**
   * Process a task list item
   */
  private processTaskItem(
    item: ListItem,
    filePath: string,
    graph: CannonballGraph
  ): GraphNode {
    // Extract content and task state
    const taskState = this.getTaskState(item);

    // Extract task content
    let content = '';
    visit(item, 'text', (textNode: Text) => {
      content += textNode.value;
    });

    // Strip task marker from content
    content = content.replace(/^\s*\[[x ./\-!]\]\s*/, '');

    // Generate a position-based ID for the task
    const listPosition = item.position ?
      `${item.position.start.line}-${item.position.start.column}` :
      `task-${Date.now()}`;

    // Create the task node
    const node: GraphNode = {
      id: generateNodeId(filePath, { listPosition }),
      type: NodeType.Task,
      content,
      metadata: {
        position: item.position,
        listPosition,
        filePath,
        taskState
      },
      createdDate: new Date(),
      modifiedDate: new Date(),
    };

    graph.addNode(node);

    return node;
  }

  /**
   * Process a regular bullet list item
   */
  private processBulletItem(
    item: ListItem,
    filePath: string,
    graph: CannonballGraph
  ): GraphNode {
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
    const node: GraphNode = {
      id: generateNodeId(filePath, { listPosition }),
      type: NodeType.Bullet,
      content,
      metadata: {
        position: item.position,
        listPosition,
        filePath
      },
      createdDate: new Date(),
      modifiedDate: new Date(),
    };

    graph.addNode(node);

    return node;
  }

  /**
   * Process a paragraph node
   */
  private processParagraph(
    paragraph: Paragraph,
    filePath: string,
    graph: CannonballGraph
  ): GraphNode {
    // Extract text
    let content = '';
    visit(paragraph, 'text', (textNode: Text) => {
      content += textNode.value;
    });

    // Create node
    const node: GraphNode = {
      id: generateNodeId(filePath, {
        identifier: `p-${(paragraph.position?.start.line ?? 0)}`
      }),
      type: NodeType.Generic,
      content,
      metadata: {
        position: paragraph.position,
        filePath
      },
      createdDate: new Date(),
      modifiedDate: new Date(),
    };

    graph.addNode(node);

    return node;
  }

  /**
   * Process a code block
   */
  private processCode(
    code: Code,
    filePath: string,
    graph: CannonballGraph
  ): GraphNode {
    // Create node
    const node: GraphNode = {
      id: generateNodeId(filePath, {
        identifier: `code-${(code.position?.start.line ?? 0)}`
      }),
      type: NodeType.Generic,
      content: code.value,
      metadata: {
        language: code.lang,
        position: code.position,
        filePath
      },
      createdDate: new Date(),
      modifiedDate: new Date(),
    };

    graph.addNode(node);

    return node;
  }

  /**
   * Process a generic AST node
   */
  private processGenericNode(
    node: Node,
    filePath: string,
    graph: CannonballGraph
  ): GraphNode | null {
    // Skip certain node types that are handled separately
    if (['heading', 'list', 'listItem', 'paragraph', 'text'].includes(node.type)) {
      return null;
    }

    // Create a generic node
    const genericNode: GraphNode = {
      id: generateNodeId(filePath, {
        identifier: `${node.type}-${(node.position?.start.line ?? 0)}`
      }),
      type: NodeType.Generic,
      content: this.extractNodeContent(node),
      metadata: {
        nodeType: node.type,
        position: node.position,
        filePath
      },
      createdDate: new Date(),
      modifiedDate: new Date(),
    };

    graph.addNode(genericNode);

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
    });

    return state;
  }

  /**
   * Process semantic relationships in the graph
   * This adds relationships beyond the basic structure
   */
  private processRelationships(graph: CannonballGraph): void {
    // Find all bullet nodes that contain tasks
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
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
              // Edge might already exist, that's fine
            }
          }
        }
      }
    }

    // Also handle task hierarchies across multiple levels
    this.processDeepTaskDependencies(graph);
  }

  /**
   * Find all tasks nested under a node at any level
   */
  private findNestedTasks(graph: CannonballGraph, node: GraphNode): GraphNode[] {
    const tasks: GraphNode[] = [];

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
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
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