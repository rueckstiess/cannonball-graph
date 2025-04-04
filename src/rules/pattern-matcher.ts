import { Graph, Node, NodeId, Edge } from "../graph/types";
import { NodePattern, RelationshipPattern, PathPattern } from "./types";

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
   * Finds relationships in the graph that match the given relationship pattern
   * @param graph The graph to search
   * @param pattern The relationship pattern to match
   * @param sourceId Optional source node ID to filter relationships
   * @returns Array of matching relationships
   */
  findMatchingRelationships(
    graph: Graph<NodeData, EdgeData>,
    pattern: RelationshipPattern,
    sourceId?: NodeId
  ): Edge<EdgeData>[];

  /**
   * Checks if a specific relationship matches the given relationship pattern
   * @param edge The edge to check
   * @param pattern The relationship pattern to match against
   * @param sourceNode Optional source node of the relationship
   * @param targetNode Optional target node of the relationship
   * @returns True if the relationship matches the pattern
   */
  matchesRelationshipPattern(
    edge: Edge<EdgeData>,
    pattern: RelationshipPattern,
    sourceNode?: Node<NodeData>,
    targetNode?: Node<NodeData>
  ): boolean;

  /**
   * Creates a filtered view of relationships by type
   * @param graph The graph to filter
   * @param type The relationship type to filter by
   * @returns Array of relationships with the given type
   */
  getRelationshipsByType(
    graph: Graph<NodeData, EdgeData>,
    type: string
  ): Edge<EdgeData>[];

  /**
   * Finds paths in the graph that match the given path pattern
   * @param graph The graph to search
   * @param pattern The path pattern to match
   * @returns Array of matching paths, where each path contains arrays of nodes and edges
   */
  findMatchingPaths(
    graph: Graph<NodeData, EdgeData>,
    pattern: PathPattern
  ): Array<{
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
  }>;

  /**
   * Clears any internal caches
   */
  clearCache(): void;
}

/**
 * Implementation of the pattern matcher
 */
export class PatternMatcherImpl<NodeData = any, EdgeData = any> implements PatternMatcher<NodeData, EdgeData> {
  private options: Required<PatternMatcherOptions>;

  // Cache for node labels
  private labelCache: Map<string, NodeId[]> = new Map();

  // Cache for relationship types
  private typeCache: Map<string, Array<[NodeId, NodeId, string]>> = new Map();

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
   * Finds relationships in the graph that match the given relationship pattern
   * @param graph The graph to search
   * @param pattern The relationship pattern to match
   * @param sourceId Optional source node ID to filter relationships
   * @returns Array of matching relationships
   */
  findMatchingRelationships(
    graph: Graph<NodeData, EdgeData>,
    pattern: RelationshipPattern,
    sourceId?: NodeId
  ): Edge<EdgeData>[] {
    // If sourceId is specified, use it to get relevant edges directly
    if (sourceId) {
      const sourceNode = graph.getNode(sourceId);
      if (!sourceNode) {
        return []; // Source node doesn't exist
      }

      // Direction determines how we filter edges for the specified source node
      let edges: Edge<EdgeData>[] = [];

      if (pattern.direction === 'outgoing') {
        // For outgoing, source node must be the source of the edge
        edges = graph.getEdgesForNode(sourceId, 'outgoing');
      } else if (pattern.direction === 'incoming') {
        // For incoming, source node must be the target of the edge
        edges = graph.getEdgesForNode(sourceId, 'incoming');
      } else {
        // For both, include all edges connected to the source node
        edges = graph.getEdgesForNode(sourceId, 'both');
      }

      // Filter edges by pattern
      return edges.filter(edge => {
        // If type is specified, check it matches
        if (pattern.type && !this.typeMatches(edge.label, pattern.type)) {
          return false;
        }

        const edgeSourceNode = graph.getNode(edge.source);
        const edgeTargetNode = graph.getNode(edge.target);

        if (!edgeSourceNode || !edgeTargetNode) {
          return false; // Skip edges with missing nodes
        }

        // Check if the edge matches the pattern
        // For incoming relationships when sourceId is specified, 
        // we need to use a special check to handle the direction correctly
        if (pattern.direction === 'incoming' && edge.target === sourceId) {
          // For incoming, we need to reverse the expected direction in the pattern
          // because matchesRelationshipPattern expects sourceNode to be the source of the edge
          const reverseDirectionPattern: RelationshipPattern = {
            ...pattern,
            direction: 'outgoing' // Inverse the direction for the check
          };

          return this.matchesRelationshipPattern(
            edge,
            reverseDirectionPattern,
            edgeSourceNode,
            edgeTargetNode
          );
        }

        // For outgoing or both, use the pattern as is
        return this.matchesRelationshipPattern(
          edge,
          pattern,
          edgeSourceNode,
          edgeTargetNode
        );
      });
    }

    // If pattern has a type but no sourceId, use getRelationshipsByType
    if (pattern.type) {
      const typedEdges = this.getRelationshipsByType(graph, pattern.type);

      // Filter edges by pattern (excluding type which we already checked)
      return typedEdges.filter(edge => {
        const sourceNode = graph.getNode(edge.source);
        const targetNode = graph.getNode(edge.target);

        if (!sourceNode || !targetNode) {
          return false; // Skip edges with missing nodes
        }

        const noTypePattern = {
          ...pattern,
          type: undefined // Remove type since we already filtered by it
        };

        return this.matchesRelationshipPattern(
          edge,
          noTypePattern,
          sourceNode,
          targetNode
        );
      });
    }

    // If no type and no sourceId, check all edges
    return graph.findEdges(edge => {
      const sourceNode = graph.getNode(edge.source);
      const targetNode = graph.getNode(edge.target);

      if (!sourceNode || !targetNode) {
        return false; // Skip edges with missing nodes
      }

      return this.matchesRelationshipPattern(
        edge,
        pattern,
        sourceNode,
        targetNode
      );
    });
  }

  /**
   * Checks if a specific relationship matches the given relationship pattern
   */
  matchesRelationshipPattern(
    edge: Edge<EdgeData>,
    pattern: RelationshipPattern,
    sourceNode?: Node<NodeData>,
    targetNode?: Node<NodeData>
  ): boolean {
    // Check if relationship type matches
    if (pattern.type && !this.typeMatches(edge.label, pattern.type)) {
      return false;
    }

    // Check direction (if source and target nodes are provided)
    if (sourceNode && targetNode && pattern.direction !== 'both') {
      const isOutgoing = edge.source === sourceNode.id && edge.target === targetNode.id;
      const isIncoming = edge.source === targetNode.id && edge.target === sourceNode.id;

      if (pattern.direction === 'outgoing' && !isOutgoing) {
        return false;
      }

      if (pattern.direction === 'incoming' && !isIncoming) {
        return false;
      }
    }

    // Check if relationship matches property constraints
    if (Object.keys(pattern.properties).length > 0) {
      return this.edgePropertiesMatch(edge, pattern.properties);
    }

    // If we get here, all checks passed
    return true;
  }

  /**
   * Creates a filtered view of relationships by type
   */
  getRelationshipsByType(
    graph: Graph<NodeData, EdgeData>,
    type: string
  ): Edge<EdgeData>[] {
    const normalizedType = this.normalizeLabel(type);

    // Use cached edge identifiers if available
    let edgeIdentifiers = this.typeCache.get(normalizedType);

    if (!edgeIdentifiers) {
      // Build and cache the list of edge identifiers with this type
      const matchingEdges = graph.findEdges(edge =>
        this.typeMatches(edge.label, type)
      );

      edgeIdentifiers = matchingEdges.map(edge => [
        edge.source,
        edge.target,
        edge.label
      ]);

      this.typeCache.set(normalizedType, edgeIdentifiers);
    }

    // Return actual edges (in case they've been updated)
    return edgeIdentifiers
      .map(([source, target, label]) => graph.getEdge(source, target, label))
      .filter((edge): edge is Edge<EdgeData> => edge !== undefined);
  }

  /**
   * Finds paths in the graph that match the given path pattern
   */
  findMatchingPaths(
    graph: Graph<NodeData, EdgeData>,
    pattern: PathPattern
  ): Array<{
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
  }> {
    // Start by finding all nodes that match the start pattern
    const startNodes = this.findMatchingNodes(graph, pattern.start);

    const results: Array<{
      nodes: Node<NodeData>[];
      edges: Edge<EdgeData>[];
    }> = [];

    // For each starting node, try to match the complete path
    for (const startNode of startNodes) {
      const matchingPaths = this.findPathsFromNode(graph, startNode, pattern);
      results.push(...matchingPaths);
    }

    return results;
  }

  /**
   * Clears the label and type caches
   */
  clearCache(): void {
    this.labelCache.clear();
    this.typeCache.clear();
  }

  /**
   * Finds all paths starting from a given node that match the pattern
   * @private
   */
  private findPathsFromNode(
    graph: Graph<NodeData, EdgeData>,
    startNode: Node<NodeData>,
    pattern: PathPattern
  ): Array<{
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
  }> {
    // Start with just the initial node
    const initialPath = {
      nodes: [startNode],
      edges: [] as Edge<EdgeData>[]
    };

    // If there are no segments, we're done
    if (pattern.segments.length === 0) {
      return [initialPath];
    }

    return this.extendPath(graph, initialPath, pattern, 0);
  }

  /**
   * Recursively extends a path to match the pattern segments
   * @private
   */
  private extendPath(
    graph: Graph<NodeData, EdgeData>,
    currentPath: {
      nodes: Node<NodeData>[];
      edges: Edge<EdgeData>[];
    },
    pattern: PathPattern,
    segmentIndex: number
  ): Array<{
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
  }> {
    // If we've matched all segments, return the current path
    if (segmentIndex >= pattern.segments.length) {
      return [currentPath];
    }

    const results: Array<{
      nodes: Node<NodeData>[];
      edges: Edge<EdgeData>[];
    }> = [];

    // Get the current node (last in the path)
    const currentNode = currentPath.nodes[currentPath.nodes.length - 1];

    // Get the current segment to match
    const segment = pattern.segments[segmentIndex];

    // Find matching relationships
    const relationshipPattern = segment.relationship;
    let edgesForNode: Edge<EdgeData>[] = [];

    // Get edges based on the direction in the relationship pattern
    if (relationshipPattern.direction === 'outgoing') {
      // For outgoing, look at edges where current node is the source
      edgesForNode = graph.getEdgesForNode(currentNode.id, 'outgoing');
    } else if (relationshipPattern.direction === 'incoming') {
      // For incoming, look at edges where current node is the target
      edgesForNode = graph.getEdgesForNode(currentNode.id, 'incoming');
    } else {
      // For 'both', look at all edges connected to the node
      edgesForNode = graph.getEdgesForNode(currentNode.id, 'both');
    }

    for (const edge of edgesForNode) {
      // Determine roles (current node vs. other node)
      const isOutgoing = edge.source === currentNode.id;
      const otherNodeId = isOutgoing ? edge.target : edge.source;
      const otherNode = graph.getNode(otherNodeId);

      if (!otherNode) continue;

      // Check if the relationship matches the pattern
      const matchesDirection =
        (relationshipPattern.direction === 'outgoing' && isOutgoing) ||
        (relationshipPattern.direction === 'incoming' && !isOutgoing) ||
        (relationshipPattern.direction === 'both');

      if (!matchesDirection) continue;

      // Use the right nodes as source/target for relationship matching
      const sourceNode = isOutgoing ? currentNode : otherNode;
      const targetNode = isOutgoing ? otherNode : currentNode;

      // For path matching, we need to handle the direction differently than in findMatchingRelationships
      let patternToMatch = relationshipPattern;
      if (relationshipPattern.direction === 'incoming' && !isOutgoing) {
        // We need to flip the direction for incoming paths when matching
        patternToMatch = {
          ...relationshipPattern,
          direction: 'outgoing' // Treat as outgoing for the pattern match
        };
      }

      if (this.matchesRelationshipPattern(
        edge,
        patternToMatch,
        sourceNode,
        targetNode
      )) {
        // Check if the other node matches the node pattern
        if (this.matchesNodePattern(otherNode, segment.node)) {
          // Create a new path with this relationship and node
          const newPath = {
            nodes: [...currentPath.nodes, otherNode],
            edges: [...currentPath.edges, edge]
          };

          // Continue matching the rest of the pattern
          const extendedPaths = this.extendPath(
            graph,
            newPath,
            pattern,
            segmentIndex + 1
          );

          results.push(...extendedPaths);
        }
      }
    }

    return results;
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
   * Checks if a relationship type matches the required type
   * @private
   */
  private typeMatches(relationshipType: string, requiredType: string): boolean {
    if (this.options.caseSensitiveLabels) {
      return relationshipType === requiredType;
    }

    return relationshipType.toLowerCase() === requiredType.toLowerCase();
  }

  /**
   * Normalizes a label or type for consistent matching
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
   * Checks if relationship properties match the required properties
   * @private
   */
  private edgePropertiesMatch(
    edge: Edge<EdgeData>,
    requiredProps: Record<string, any>
  ): boolean {
    if (!edge.data || typeof edge.data !== 'object' || edge.data === null) {
      return Object.keys(requiredProps).length === 0;
    }

    const edgeData = edge.data as Record<string, any>;

    for (const [key, requiredValue] of Object.entries(requiredProps)) {
      if (!(key in edgeData)) {
        return false;
      }

      const edgeValue = edgeData[key];

      if (!this.valuesMatch(edgeValue, requiredValue)) {
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