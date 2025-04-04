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

  /**
   * Maximum depth for variable-length paths to avoid excessive computation
   * @default 10
   */
  maxPathDepth?: number;

  /**
   * Maximum number of paths to return for variable-length path queries
   * @default 100
   */
  maxPathResults?: number;
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
      maxPathDepth: options.maxPathDepth ?? 10,
      maxPathResults: options.maxPathResults ?? 100
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

    // Check if any segment has variable length path (minHops/maxHops)
    const hasVariablePath = pattern.segments.some(
      segment => segment.relationship.minHops !== undefined || segment.relationship.maxHops !== undefined
    );

    // Apply path matching approach based on whether variable paths are involved
    if (hasVariablePath) {
      // Use BFS approach for variable length paths
      for (const startNode of startNodes) {
        this.findVariableLengthPaths(graph, startNode, pattern, results);
      }
    } else {
      // Use simpler approach for fixed-length paths
      for (const startNode of startNodes) {
        const matchingPaths = this.findPathsFromNode(graph, startNode, pattern);
        results.push(...matchingPaths);
      }
    }

    // Enforce maxPathResults limit if there are too many results
    if (results.length > this.options.maxPathResults) {
      return results.slice(0, this.options.maxPathResults);
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
      edges: [] as Edge<EdgeData>[],
      visited: new Set<NodeId>([startNode.id]) // Track visited nodes to avoid cycles
    };

    // If there are no segments, we're done
    if (pattern.segments.length === 0) {
      const { visited, ...result } = initialPath; // Remove visited from result
      return [result];
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
      visited: Set<NodeId>;
    },
    pattern: PathPattern,
    segmentIndex: number
  ): Array<{
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
  }> {
    // If we've matched all segments, return the current path
    if (segmentIndex >= pattern.segments.length) {
      const { visited, ...result } = currentPath; // Remove visited from result
      return [result];
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

      // Skip if we've already visited this node (avoid cycles)
      if (currentPath.visited.has(otherNodeId)) {
        continue;
      }

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
            edges: [...currentPath.edges, edge],
            visited: new Set(currentPath.visited) // Clone the visited set
          };
          newPath.visited.add(otherNodeId); // Mark the new node as visited

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
   * Finds variable-length paths from a start node
   * Uses breadth-first search to respect hop constraints
   * @private
   */
  private findVariableLengthPaths(
    graph: Graph<NodeData, EdgeData>,
    startNode: Node<NodeData>,
    pattern: PathPattern,
    results: Array<{
      nodes: Node<NodeData>[];
      edges: Edge<EdgeData>[];
    }>
  ): void {
    // We only support variable-length paths for the first segment right now
    const segment = pattern.segments[0];
    const relationshipPattern = segment.relationship;
    const targetNodePattern = segment.node;

    // Default min and max hops if not specified
    const minHops = relationshipPattern.minHops !== undefined ? relationshipPattern.minHops : 1;
    const maxHops = relationshipPattern.maxHops !== undefined ? relationshipPattern.maxHops : this.options.maxPathDepth;

    // Initialize queue with start node
    const queue: Array<{
      path: {
        nodes: Node<NodeData>[];
        edges: Edge<EdgeData>[];
      };
      hops: number; // Number of hops taken so far
      visited: Set<NodeId>; // Track visited nodes to avoid cycles
    }> = [
        {
          path: {
            nodes: [startNode],
            edges: []
          },
          hops: 0,
          visited: new Set<NodeId>([startNode.id])
        }
      ];

    // Set to track found paths to avoid duplicates
    const foundPathKeys = new Set<string>();

    // BFS to find all paths
    while (queue.length > 0 && results.length < this.options.maxPathResults) {
      const { path, hops, visited } = queue.shift()!;
      const currentNode = path.nodes[path.nodes.length - 1];

      // If we've reached max hops, continue to next item in queue
      if (hops >= maxHops) {
        continue;
      }

      // Expand node - get relationships to traverse
      let edgesForNode: Edge<EdgeData>[] = [];

      if (relationshipPattern.direction === 'outgoing') {
        edgesForNode = graph.getEdgesForNode(currentNode.id, 'outgoing');
      } else if (relationshipPattern.direction === 'incoming') {
        edgesForNode = graph.getEdgesForNode(currentNode.id, 'incoming');
      } else {
        edgesForNode = graph.getEdgesForNode(currentNode.id, 'both');
      }

      // Process each edge
      for (const edge of edgesForNode) {
        // Skip edges that don't match the relationship type
        if (relationshipPattern.type && !this.typeMatches(edge.label, relationshipPattern.type)) {
          continue;
        }

        // Check if the relationship properties match
        if (Object.keys(relationshipPattern.properties).length > 0 &&
          !this.edgePropertiesMatch(edge, relationshipPattern.properties)) {
          continue;
        }

        // Determine the other node
        const isOutgoing = edge.source === currentNode.id;
        const otherNodeId = isOutgoing ? edge.target : edge.source;

        // Check relationship direction
        const matchesDirection =
          (relationshipPattern.direction === 'outgoing' && isOutgoing) ||
          (relationshipPattern.direction === 'incoming' && !isOutgoing) ||
          (relationshipPattern.direction === 'both');

        if (!matchesDirection) {
          continue;
        }

        // Skip if already visited (avoid cycles)
        if (visited.has(otherNodeId)) {
          continue;
        }

        const otherNode = graph.getNode(otherNodeId);
        if (!otherNode) continue;

        // Create a new path with this edge
        const newPath = {
          nodes: [...path.nodes, otherNode],
          edges: [...path.edges, edge]
        };

        // Track visited nodes
        const newVisited = new Set(visited);
        newVisited.add(otherNodeId);

        // Check if the new node matches the target pattern
        if (hops + 1 >= minHops && this.matchesNodePattern(otherNode, targetNodePattern)) {
          // We've found a valid path

          // Check for duplicates (using a simple string representation)
          const pathKey = newPath.nodes.map(n => n.id).join(',');
          if (!foundPathKeys.has(pathKey)) {
            foundPathKeys.add(pathKey);

            // Check if there are more segments in the pattern
            if (pattern.segments.length > 1) {
              // If there are more segments, continue from this node
              const remainingPattern: PathPattern = {
                start: targetNodePattern,
                segments: pattern.segments.slice(1)
              };

              const continuedPaths = this.findPathsFromNode(graph, otherNode, remainingPattern);

              for (const continuedPath of continuedPaths) {
                // Combine the current path up to otherNode with the continued path
                results.push({
                  nodes: [...newPath.nodes.slice(0, -1), ...continuedPath.nodes],
                  edges: [...newPath.edges, ...continuedPath.edges]
                });

                // Check if we've reached the limit
                if (results.length >= this.options.maxPathResults) {
                  return;
                }
              }
            } else {
              // If this is the only segment, add the path to results
              results.push(newPath);

              // Check if we've reached the limit
              if (results.length >= this.options.maxPathResults) {
                return;
              }
            }
          }
        }

        // Add to queue for further expansion (unless we've reached the max depth)
        if (hops + 1 < maxHops) {
          queue.push({
            path: newPath,
            hops: hops + 1,
            visited: newVisited
          });
        }
      }
    }
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