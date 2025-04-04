import { Graph, Node, NodeId } from "../graph/types";
import { NodePattern } from "./types";

/**
 * Interface for the pattern matcher
 */
export interface PatternMatcher<NodeData = any, EdgeData = any> {
  /**
   * Finds nodes in the graph that match the given node pattern
   * @param graph The graph to search
   * @param pattern The node pattern to match
   * @returns Array of matching nodes
   */
  findMatchingNodes(
    graph: Graph<NodeData, EdgeData>,
    pattern: NodePattern
  ): Node<NodeData>[];

  /**
   * Checks if a specific node matches the given node pattern
   * @param node The node to check
   * @param pattern The node pattern to match against
   * @returns True if the node matches the pattern
   */
  matchesNodePattern(
    node: Node<NodeData>,
    pattern: NodePattern
  ): boolean;

  /**
   * Creates a filtered view of nodes by label
   * @param graph The graph to filter
   * @param label The label to filter by
   * @returns Array of nodes with the given label
   */
  getNodesByLabel(
    graph: Graph<NodeData, EdgeData>,
    label: string
  ): Node<NodeData>[];

  /**
   * Clears any internal caches
   */
  clearCache(): void;
}

/**
 * Options for the pattern matcher
 */
export interface PatternMatcherOptions {
  /**
   * Whether to use case-sensitive matching for labels
   * @default false
   */
  caseSensitiveLabels?: boolean;

  /**
   * Whether to enable property type coercion (e.g., string "42" matches number 42)
   * @default false
   */
  enableTypeCoercion?: boolean;
}

/**
 * Implementation of the pattern matcher
 */
export class PatternMatcherImpl<NodeData = any, EdgeData = any> implements PatternMatcher<NodeData, EdgeData> {
  private options: Required<PatternMatcherOptions>;
  private labelCache: Map<string, NodeId[]> = new Map();

  constructor(options: PatternMatcherOptions = {}) {
    this.options = {
      caseSensitiveLabels: options.caseSensitiveLabels ?? false,
      enableTypeCoercion: options.enableTypeCoercion ?? false,
    };
  }

  /**
   * Finds nodes in the graph that match the given node pattern
   */
  findMatchingNodes(
    graph: Graph<NodeData, EdgeData>,
    pattern: NodePattern
  ): Node<NodeData>[] {
    // If pattern has a label, use it to filter nodes first
    if (pattern.labels && pattern.labels.length > 0) {
      // Get nodes with the first label (we can refine with other labels later)
      const labeledNodes = this.getNodesByLabel(graph, pattern.labels[0]);
      
      return labeledNodes.filter(node => this.matchesNodePattern(node, pattern));
    }
    
    // If no label, check all nodes against the pattern
    return graph.findNodes(node => this.matchesNodePattern(node, pattern));
  }

  /**
   * Checks if a specific node matches the given node pattern
   */
  matchesNodePattern(
    node: Node<NodeData>,
    pattern: NodePattern
  ): boolean {
    // Check if node has all required labels
    if (pattern.labels && pattern.labels.length > 0) {
      const nodeLabels = this.getNodeLabels(node);
      
      for (const requiredLabel of pattern.labels) {
        if (!this.labelMatches(nodeLabels, requiredLabel)) {
          return false;
        }
      }
    }
    
    // Check if node matches property constraints
    if (Object.keys(pattern.properties).length > 0) {
      return this.nodePropertiesMatch(node, pattern.properties);
    }
    
    // If we get here, all checks passed
    return true;
  }

  /**
   * Creates a filtered view of nodes by label
   */
  getNodesByLabel(
    graph: Graph<NodeData, EdgeData>,
    label: string
  ): Node<NodeData>[] {
    const normalizedLabel = this.normalizeLabel(label);
    
    // Use cached ids if available
    let nodeIds = this.labelCache.get(normalizedLabel);
    
    if (!nodeIds) {
      // Build and cache the list of node IDs with this label
      const matchingNodes = graph.findNodes(node => 
        this.labelMatches(this.getNodeLabels(node), label)
      );
      
      nodeIds = matchingNodes.map(node => node.id);
      this.labelCache.set(normalizedLabel, nodeIds);
    }
    
    // Return actual nodes (in case they've been updated)
    return nodeIds
      .map(id => graph.getNode(id))
      .filter((node): node is Node<NodeData> => node !== undefined);
  }

  /**
   * Clears the label cache
   */
  clearCache(): void {
    this.labelCache.clear();
  }

  /**
   * Extracts labels from a node's data
   * @private
   */
  private getNodeLabels(node: Node<NodeData>): string[] {
    // If node.data is an object with a type property, use it as a label
    if (node.data && typeof node.data === 'object' && node.data !== null) {
      const data = node.data as Record<string, any>;
      
      if (data.type) {
        if (Array.isArray(data.type)) {
          return data.type;
        }
        return [data.type];
      }
      
      // Look for a labels array
      if (data.labels && Array.isArray(data.labels)) {
        return data.labels;
      }
    }
    
    return [];
  }

  /**
   * Checks if a node's labels include the required label
   * @private
   */
  private labelMatches(nodeLabels: string[], requiredLabel: string): boolean {
    const normalizedRequired = this.normalizeLabel(requiredLabel);
    
    return nodeLabels.some(label => 
      this.normalizeLabel(label) === normalizedRequired
    );
  }

  /**
   * Normalizes a label for consistent matching
   * @private
   */
  private normalizeLabel(label: string): string {
    return this.options.caseSensitiveLabels ? label : label.toLowerCase();
  }

  /**
   * Checks if a node's properties match the required properties
   * @private
   */
  private nodePropertiesMatch(
    node: Node<NodeData>,
    requiredProps: Record<string, any>
  ): boolean {
    if (!node.data || typeof node.data !== 'object' || node.data === null) {
      return Object.keys(requiredProps).length === 0;
    }
    
    const nodeData = node.data as Record<string, any>;
    
    for (const [key, requiredValue] of Object.entries(requiredProps)) {
      if (!(key in nodeData)) {
        return false;
      }
      
      const nodeValue = nodeData[key];
      
      if (!this.valuesMatch(nodeValue, requiredValue)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Checks if two values match, accounting for type coercion if enabled
   * @private
   */
  private valuesMatch(actual: any, expected: any): boolean {
    if (actual === expected) {
      return true;
    }
    
    if (this.options.enableTypeCoercion) {
      // Handle type coercion scenarios
      if (typeof expected === 'number' && typeof actual === 'string') {
        return parseFloat(actual) === expected;
      }
      
      if (typeof expected === 'boolean') {
        if (typeof actual === 'string') {
          const normalized = actual.toLowerCase();
          if (expected === true && normalized === 'true') return true;
          if (expected === false && normalized === 'false') return true;
        }
        else if (typeof actual === 'number') {
          if (expected === true && actual === 1) return true;
          if (expected === false && actual === 0) return true;
        }
      }
    }
    
    return false;
  }
}