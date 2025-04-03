// src/parser/markdown-parser.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { Root, Node } from 'mdast';
import { visitParents, SKIP } from 'unist-util-visit-parents';

import { CannonballGraph } from '@/core/graph';
import { NodeType, RelationType } from '@/core/types';
import { BaseNode, NodeFactory } from '@/core/node';
import { NoteNode } from '@/core/nodes';
import { createParserContext, ParserContext } from './parser-context';
import { NodeRegistry } from '@/core/node-registry';

import { inspect } from 'unist-util-inspect'

/**
 * Parser that converts Markdown content into a Cannonball graph
 * using a node-driven approach where each node type knows how to parse itself
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

    // Create a root node for the document
    const rootNode = new NoteNode(
      filePath,
      filePath.split('/').pop() || '',
      {
        filePath,
        position: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
      }
    );

    graph.addNode(rootNode);

    // Set up the parser context with the root node
    const context = createParserContext(filePath, graph, rootNode);

    // Process the AST
    this.processAst(ast, context);

    // Process relationships between nodes
    this.processRelationships(graph);

    return graph;
  }

  /**
   * Process the Markdown AST and populate the graph
   * @param ast - The Markdown AST root node
   * @param context - The parser context
   */
  private processAst(ast: Root, context: ParserContext): void {
    // Store the AST to graph node mapping for the root node
    context.mapAstToGraph(ast, context.containerStack[0]);

    // Visit each node in the AST
    visitParents(ast, (node: Node, ancestors) => {
      // Skip the root node, already handled
      if (node.type === 'root') return;

      // Skip certain node types that don't need direct graph nodes
      if (['text', 'emphasis', 'strong', 'link', 'inlineCode', 'list'].includes(node.type)) {
        return;
      }

      // Find a node class that can parse this AST node type
      const nodeClass = NodeRegistry.findParserForAst(node);

      if (nodeClass) {
        try {
          // Try to create a graph node from the AST node
          const graphNode = nodeClass.fromAst(node, context, ancestors);

          if (graphNode) {
            // Store AST to Graph node mapping
            context.mapAstToGraph(node, graphNode);

            // Skip child traversal for certain nodes
            if (this.shouldSkipChildren(node)) {
              return SKIP;
            }
          }
        } catch (error) {
          console.warn(`Error parsing ${node.type} node:`, error);
        }
      } else if (NodeFactory.fromAst) {
        // Fallback to generic node if needed
        try {
          const graphNode = NodeFactory.fromAst(node, context, ancestors);
          if (graphNode) {
            context.mapAstToGraph(node, graphNode);
          }
        } catch (error) {
          console.warn(`Error creating generic node for ${node.type}:`, error);
        }
      }
    });
  }

  /**
   * Determine if we should skip children of a node in the traversal
   */
  private shouldSkipChildren(node: Node): boolean {
    // We typically want to skip the children of these nodes because:
    // - Heading content is already processed in the heading node
    // - Code blocks should be treated as single units
    // - List items process their own children
    return ['heading', 'code'].includes(node.type);
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