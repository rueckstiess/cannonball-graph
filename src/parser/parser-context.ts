// src/parser/parser-context.ts
import { CannonballGraph } from '@/core/graph';
import { BaseNode, ContainerNode } from '@/core/node';
import { RelationType } from '@/core/types';
import { Node as MdastNode } from 'mdast';
import { getAstNodeId } from '@/core/ast-convertible';

/**
 * Context passed during parsing to maintain state
 */
export interface ParserContext {
  /** Path of the file being parsed */
  filePath: string;

  /** The graph being built */
  graph: CannonballGraph;

  /** Stack of container nodes representing the current hierarchy */
  containerStack: ContainerNode[];

  /** Map of AST node IDs to graph nodes for reference */
  nodeMap: Map<string, BaseNode>;

  /**
   * Add a node to the graph and establish containment relationship
   * @param node - The node to add to the graph
   */
  addNodeToGraph(node: BaseNode): void;

  /**
   * Get the current container (top of the stack)
   * @returns The current container node
   */
  getCurrentContainer(): ContainerNode;

  /**
   * Store a mapping from AST node to graph node
   * @param astNode - The AST node
   * @param graphNode - The corresponding graph node
   */
  mapAstToGraph(astNode: MdastNode, graphNode: BaseNode): void;

  /**
   * Get the graph node corresponding to an AST node
   * @param astNode - The AST node
   * @returns The corresponding graph node, if found
   */
  getNodeForAst(astNode: MdastNode): BaseNode | undefined;
}

/**
 * Create a new parser context
 */
export function createParserContext(
  filePath: string,
  graph: CannonballGraph,
  rootNode: ContainerNode
): ParserContext {
  // Initialize the context
  const context: ParserContext = {
    filePath,
    graph,
    containerStack: [rootNode],
    nodeMap: new Map<string, BaseNode>(),

    addNodeToGraph(node: BaseNode): void {
      // Add the node to the graph
      this.graph.addNode(node);

      // If we have a current container, add containment relationship
      if (this.containerStack.length > 0) {
        const parentContainer = this.getCurrentContainer();

        this.graph.addEdge({
          source: parentContainer.id,
          target: node.id,
          relation: RelationType.ContainsChild,
          metadata: {}
        });
      }
    },

    getCurrentContainer(): ContainerNode {
      if (this.containerStack.length === 0) {
        throw new Error('Container stack is empty');
      }
      return this.containerStack[this.containerStack.length - 1];
    },

    mapAstToGraph(astNode: MdastNode, graphNode: BaseNode): void {
      const astId = getAstNodeId(astNode);
      this.nodeMap.set(astId, graphNode);
    },

    getNodeForAst(astNode: MdastNode): BaseNode | undefined {
      const astId = getAstNodeId(astNode);
      return this.nodeMap.get(astId);
    }
  };

  return context;
}