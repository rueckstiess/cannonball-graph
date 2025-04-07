// Unique identifier for nodes
export type NodeId = string;

/**
 * Core node structure in the graph
 * @template T Type of data associated with the node
 */
export interface Node<T = any> {
  /** Unique identifier for the node */
  id: NodeId;
  /** label of the Node */
  label: string;
  /** Data associated with the node */
  data: T;
}

/**
 * Edge connecting two nodes in the graph
 * @template T Type of data associated with the edge
 */
export interface Edge<T = any> {
  /** ID of the source node */
  source: NodeId;
  /** ID of the target node */
  target: NodeId;
  /** Type or category of the relationship */
  label: string;
  /** Data associated with the edge */
  data: T;
}

export type EdgeDirection = "outgoing" | "incoming" | "both";

/**
 * Represents a path in the graph
 * @template NodeData Type of data associated with nodes
 * @template EdgeData Type of data associated with edges
 */
export interface Path<NodeData = any, EdgeData = any> {
  /** Nodes in the path in traversal order */
  nodes: Node<NodeData>[];
  /** Edges in the path in traversal order */
  edges: Edge<EdgeData>[];
}

/**
 * Options for path finding between nodes
 */
export interface PathOptions {
  /** Maximum number of hops in the path */
  maxDepth?: number;
  /** Filter paths to only include these relationship types */
  relationshipTypes?: string[];
  /** Direction to traverse: outgoing (source->target), incoming (target->source), or both */
  direction?: EdgeDirection;
}

/**
 * Options for BFS traversal
 */
export interface BFSOptions {
  /** Maximum depth to traverse */
  maxDepth?: number;
  /** Direction to traverse: outgoing, incoming, or both */
  direction?: EdgeDirection;
  /** Whether to track complete paths (needed for path patterns) */
  trackPaths?: boolean;
  /** Maximum number of results to collect */
  maxResults?: number;
}

/**
 * Visitor pattern interface for BFS traversal
 * @template NodeData Type of data associated with nodes
 * @template EdgeData Type of data associated with edges
 */
export interface BFSVisitor<NodeData = any, EdgeData = any> {
  /**
   * Called when starting the traversal
   * @param startNode The node where traversal begins
   */
  start?(startNode: Node<NodeData>): void;

  /**
   * Called when a node is discovered during traversal
   * @param node The discovered node
   * @param depth Current depth in the traversal
   * @param path The path taken to reach this node (if trackPaths is true)
   * @returns Boolean indicating whether to continue traversal from this node (true) or skip (false)
   */
  discoverNode?(
    node: Node<NodeData>,
    depth: number,
    path?: Path<NodeData, EdgeData>
  ): boolean;

  /**
   * Called when examining an edge during traversal
   * @param edge The edge being examined
   * @param sourceNode The source node of the edge
   * @param targetNode The target node of the edge
   * @param depth Current depth in the traversal
   * @returns Boolean indicating whether to traverse this edge (true) or skip (false)
   */
  examineEdge?(
    edge: Edge<EdgeData>,
    sourceNode: Node<NodeData>,
    targetNode: Node<NodeData>,
    depth: number
  ): boolean;

  /**
   * Called when a path is complete
   * @param path The complete path
   * @param depth Depth at which the path was completed
   */
  pathComplete?(
    path: Path<NodeData, EdgeData>,
    depth: number
  ): void;

  /**
   * Called after all edges of a node are examined
   * @param node The node whose examination is complete
   * @param depth Depth of the node in the traversal
   */
  finishNode?(
    node: Node<NodeData>,
    depth: number
  ): void;
}

/**
 * Serialization format for graph data
 * @template NodeData Type of data associated with nodes
 * @template EdgeData Type of data associated with edges
 */
export interface GraphData<NodeData = any, EdgeData = any> {
  nodes: Array<{
    id: NodeId;
    label: string;
    data: NodeData;
  }>;
  edges: Array<{
    source: NodeId;
    target: NodeId;
    label: string;
    data: EdgeData;
  }>;
}


/**
 * Graph
 * 
 * This provides a generic, directed graph with labeled nodes and edges.
 * Each node and edge can have associated data.
 * 
 * @template NodeData Type of data associated with nodes
 * @template EdgeData Type of data associated with edges
 */

export class Graph<NodeData = any, EdgeData = any> {
  // Maps node IDs to their node data
  private nodes: Map<NodeId, NodeData>;
  private nodeLabels: Map<NodeId, string>;

  // Maps source node ID -> target node ID -> label -> edge data
  // This structure allows efficient edge lookups and traversals
  private outgoingEdges: Map<NodeId, Map<NodeId, Map<string, EdgeData>>>;

  // Maps target node ID -> source node ID -> label -> edge data
  // This allows efficient backwards traversal
  private incomingEdges: Map<NodeId, Map<NodeId, Map<string, EdgeData>>>;

  constructor() {
    this.nodes = new Map<NodeId, NodeData>();
    this.nodeLabels = new Map<NodeId, string>();
    this.outgoingEdges = new Map<NodeId, Map<NodeId, Map<string, EdgeData>>>();
    this.incomingEdges = new Map<NodeId, Map<NodeId, Map<string, EdgeData>>>();
  }

  /**
   * Returns the full node object including its label and data.
   * @private
   * @param id The ID of the node to retrieve
   * @returns The full node object or undefined if not found
   */
  private getFullNode(id: NodeId): Node<NodeData> | undefined {
    const data = this.nodes.get(id);
    const label = this.nodeLabels.get(id);
    return data !== undefined && label !== undefined ? { id, label, data } : undefined;
  }


  // Node operations

  /**
   * Add a node to the graph
   * @param id Unique identifier for the node
   * @param label Label of the node
   * @param data Data to associate with the node
   * @throws Error if a node with the same ID already exists
   */
  addNode(id: NodeId, label: string, data: NodeData): void {
    if (this.nodes.has(id)) {
      throw new Error(`Node with ID "${id}" already exists`);
    }
    this.nodes.set(id, data);
    this.nodeLabels.set(id, label);
    this.outgoingEdges.set(id, new Map());
    this.incomingEdges.set(id, new Map());
  }

  /**
   * Get a node by its ID
   * @param id The node ID to look up
   * @returns The node object or undefined if not found
   */
  getNode(id: NodeId): Node<NodeData> | undefined {
    return this.getFullNode(id);
  }

  /**
   * Get the label of a node
   * @param id The node ID to look up
   * @returns The label of the node or undefined if not found
   */
  getNodeLabel(id: NodeId): string {
    const label = this.nodeLabels.get(id);
    if (label === undefined) {
      throw new Error(`Node with ID "${id}" has no label`);
    }
    return label;
  }

  /**
   * Check if a node exists in the graph
   * @param id The node ID to check
   * @returns True if the node exists, false otherwise
   */
  hasNode(id: NodeId): boolean {
    return this.nodes.has(id);
  }

  /**
   * Update a node's data
   * @param id The ID of the node to update
   * @param data The new data to associate with the node
   * @returns True if the node was updated, false if it doesn't exist
   */
  updateNodeData(id: NodeId, data: NodeData): boolean {
    if (!this.nodes.has(id)) {
      return false;
    }

    this.nodes.set(id, data);
    return true;
  }

  /**
   * Change the label of a node
   * @param id The ID of the node to update
   * @param label The new label to associate with the node
   * @returns True if the node was updated, false if it doesn't exist
   */
  updateNodeLabel(id: NodeId, label: string): boolean {
    if (!this.nodes.has(id)) {
      return false;
    }

    this.nodeLabels.set(id, label);
    return true;
  }

  /**
   * Remove a node and all its connected edges
   * @param id The ID of the node to remove
   * @returns True if the node was removed, false if it doesn't exist
   */
  removeNode(id: NodeId): boolean {
    if (!this.nodes.has(id)) return false;

    if (this.outgoingEdges.has(id)) {
      for (const targetId of this.outgoingEdges.get(id)!.keys()) {
        this.incomingEdges.get(targetId)?.delete(id);
      }
      this.outgoingEdges.delete(id);
    }

    if (this.incomingEdges.has(id)) {
      for (const sourceId of this.incomingEdges.get(id)!.keys()) {
        this.outgoingEdges.get(sourceId)?.delete(id);
      }
      this.incomingEdges.delete(id);
    }

    this.nodes.delete(id);
    this.nodeLabels.delete(id);
    return true;
  }

  /**
   * Get all nodes in the graph
   * @returns Array of all nodes
   */
  getAllNodes(): Node<NodeData>[] {
    return Array.from(this.nodes.keys())
      .map(id => this.getFullNode(id)!)
      .filter(Boolean);
  }

  /**
   * Find nodes that match a predicate
   * @param predicate Function that tests each node
   * @returns Array of nodes that satisfy the predicate
   */
  findNodes(predicate: (node: Node<NodeData>) => boolean): Node<NodeData>[] {
    const result: Node<NodeData>[] = [];
    for (const id of this.nodes.keys()) {
      const node = this.getFullNode(id);
      if (node && predicate(node)) {
        result.push(node);
      }
    }
    return result;
  }

  // Edge operations

  /**
   * Add an edge between two nodes
   * @param source ID of the source node
   * @param target ID of the target node
   * @param label Type or category of the relationship
   * @param data Data to associate with the edge
   * @throws Error if either node doesn't exist or the edge already exists
   */
  addEdge(source: NodeId, target: NodeId, label: string, data: EdgeData): void {
    // Verify nodes exist
    if (!this.nodes.has(source)) {
      throw new Error(`Source node "${source}" doesn't exist`);
    }

    if (!this.nodes.has(target)) {
      throw new Error(`Target node "${target}" doesn't exist`);
    }

    // Check if edge already exists
    if (this.hasEdge(source, target, label)) {
      throw new Error(
        `Edge from "${source}" to "${target}" with label "${label}" already exists`,
      );
    }

    // Add to outgoing edges
    let sourceOutgoing = this.outgoingEdges.get(source);
    if (!sourceOutgoing) {
      sourceOutgoing = new Map();
      this.outgoingEdges.set(source, sourceOutgoing);
    }

    let sourceTargets = sourceOutgoing.get(target);
    if (!sourceTargets) {
      sourceTargets = new Map();
      sourceOutgoing.set(target, sourceTargets);
    }

    sourceTargets.set(label, data);

    // Add to incoming edges
    let targetIncoming = this.incomingEdges.get(target);
    if (!targetIncoming) {
      targetIncoming = new Map();
      this.incomingEdges.set(target, targetIncoming);
    }

    let targetSources = targetIncoming.get(source);
    if (!targetSources) {
      targetSources = new Map();
      targetIncoming.set(source, targetSources);
    }

    targetSources.set(label, data);
  }

  /**
   * Get an edge by source, target, and label
   * @param source ID of the source node
   * @param target ID of the target node
   * @param label Type of the relationship
   * @returns The edge object or undefined if not found
   */
  getEdge(
    source: NodeId,
    target: NodeId,
    label: string,
  ): Edge<EdgeData> | undefined {
    const sourceOutgoing = this.outgoingEdges.get(source);
    if (!sourceOutgoing) {
      return undefined;
    }

    const sourceTargets = sourceOutgoing.get(target);
    if (!sourceTargets) {
      return undefined;
    }

    const data = sourceTargets.get(label);
    if (data === undefined) {
      return undefined;
    }

    return { source, target, label, data };
  }

  /**
   * Check if an edge exists
   * @param source ID of the source node
   * @param target ID of the target node
   * @param label Optional label to check. If not provided, checks if any edge exists between source and target.
   * @returns True if the edge exists, false otherwise
   */
  hasEdge(source: NodeId, target: NodeId, label?: string): boolean {
    const sourceOutgoing = this.outgoingEdges.get(source);
    if (!sourceOutgoing) {
      return false;
    }

    const sourceTargets = sourceOutgoing.get(target);
    if (!sourceTargets) {
      return false;
    }

    if (label === undefined) {
      return sourceTargets.size > 0;
    }

    return sourceTargets.has(label);
  }

  /**
   * Update an edge's data
   * @param source ID of the source node
   * @param target ID of the target node
   * @param label Type of the relationship
   * @param data The new data to associate with the edge
   * @returns True if the edge was updated, false if it doesn't exist
   */
  updateEdge(
    source: NodeId,
    target: NodeId,
    label: string,
    data: EdgeData,
  ): boolean {
    // Check if edge exists in outgoing edges
    const sourceOutgoing = this.outgoingEdges.get(source);
    if (!sourceOutgoing) {
      return false;
    }

    const sourceTargets = sourceOutgoing.get(target);
    if (!sourceTargets || !sourceTargets.has(label)) {
      return false;
    }

    // Update outgoing edge data
    sourceTargets.set(label, data);

    // Update incoming edge data
    const targetIncoming = this.incomingEdges.get(target);
    if (targetIncoming) {
      const targetSources = targetIncoming.get(source);
      if (targetSources) {
        targetSources.set(label, data);
      }
    }

    return true;
  }

  /**
   * Remove an edge from the graph
   * @param source ID of the source node
   * @param target ID of the target node
   * @param label Optional label to specify which edge to remove. If not provided, removes all edges between source and target.
   * @returns True if any edge was removed, false otherwise
   */
  removeEdge(source: NodeId, target: NodeId, label?: string): boolean {
    // Check if source node has any outgoing edges
    const sourceOutgoing = this.outgoingEdges.get(source);
    if (!sourceOutgoing) {
      return false;
    }

    // Check if there are any edges to the target
    const sourceTargets = sourceOutgoing.get(target);
    if (!sourceTargets) {
      return false;
    }

    let removed = false;

    if (label === undefined) {
      // Remove all edges between source and target
      removed = sourceTargets.size > 0;
      sourceOutgoing.delete(target);

      // Also remove from incoming edges
      const targetIncoming = this.incomingEdges.get(target);
      if (targetIncoming) {
        targetIncoming.delete(source);
      }
    } else {
      // Remove specific edge
      removed = sourceTargets.delete(label);

      // If no more edges to target, clean up
      if (sourceTargets.size === 0) {
        sourceOutgoing.delete(target);
      }

      // Also remove from incoming edges
      const targetIncoming = this.incomingEdges.get(target);
      if (targetIncoming) {
        const targetSources = targetIncoming.get(source);
        if (targetSources) {
          targetSources.delete(label);

          // If no more edges from source, clean up
          if (targetSources.size === 0) {
            targetIncoming.delete(source);
          }
        }
      }
    }

    return removed;
  }

  /**
   * Get all edges in the graph
   * @returns Array of all edges
   */
  getAllEdges(): Edge<EdgeData>[] {
    const result: Edge<EdgeData>[] = [];

    for (const [source, targets] of this.outgoingEdges.entries()) {
      for (const [target, labels] of targets.entries()) {
        for (const [label, data] of labels.entries()) {
          result.push({ source, target, label, data });
        }
      }
    }

    return result;
  }

  /**
   * Find edges that match a predicate
   * @param predicate Function that tests each edge
   * @returns Array of edges that satisfy the predicate
   */
  findEdges(predicate: (edge: Edge<EdgeData>) => boolean): Edge<EdgeData>[] {
    const result: Edge<EdgeData>[] = [];

    for (const [source, targets] of this.outgoingEdges.entries()) {
      for (const [target, labels] of targets.entries()) {
        for (const [label, data] of labels.entries()) {
          const edge: Edge<EdgeData> = { source, target, label, data };
          if (predicate(edge)) {
            result.push(edge);
          }
        }
      }
    }

    return result;
  }

  // Traversal operations

  /**
   * Get all neighbor nodes of a node
   * @param id The ID of the node
   * @param direction Which edges to follow: outgoing, incoming, or both
   * @returns Array of neighbor nodes
   */
  getNeighbors(
    id: NodeId,
    direction: EdgeDirection = "both",
  ): Node<NodeData>[] {
    const result: Node<NodeData>[] = [];
    const visited = new Set<NodeId>();

    // Get outgoing neighbors
    if (direction === "outgoing" || direction === "both") {
      const targets = this.outgoingEdges.get(id);
      if (targets) {
        for (const targetId of targets.keys()) {
          if (!visited.has(targetId)) {
            visited.add(targetId);
            const node = this.getNode(targetId);
            if (node) {
              result.push(node);
            }
          }
        }
      }
    }

    // Get incoming neighbors
    if (direction === "incoming" || direction === "both") {
      const sources = this.incomingEdges.get(id);
      if (sources) {
        for (const sourceId of sources.keys()) {
          if (!visited.has(sourceId)) {
            visited.add(sourceId);
            const node = this.getNode(sourceId);
            if (node) {
              result.push(node);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Get all edges connected to a node
   * @param id The ID of the node
   * @param direction Which edges to include: outgoing, incoming, or both
   * @returns Array of connected edges
   */
  getEdgesForNode(
    id: NodeId,
    direction: EdgeDirection = "both",
  ): Edge<EdgeData>[] {
    const result: Edge<EdgeData>[] = [];

    // Get outgoing edges
    if (direction === "outgoing" || direction === "both") {
      const targets = this.outgoingEdges.get(id);
      if (targets) {
        for (const [targetId, labels] of targets.entries()) {
          for (const [label, data] of labels.entries()) {
            result.push({ source: id, target: targetId, label, data });
          }
        }
      }
    }

    // Get incoming edges
    if (direction === "incoming" || direction === "both") {
      const sources = this.incomingEdges.get(id);
      if (sources) {
        for (const [sourceId, labels] of sources.entries()) {
          for (const [label, data] of labels.entries()) {
            result.push({ source: sourceId, target: id, label, data });
          }
        }
      }
    }

    return result;
  }

  /**
   * Find paths between two nodes
   * @param start ID of the start node
   * @param end ID of the end node
   * @param options Configuration for path finding
   * @returns Array of paths, where each path is an array of node IDs
   */
  findPaths(start: NodeId, end: NodeId, options: PathOptions = {}): NodeId[][] {
    // Default values
    const maxDepth = options.maxDepth || Number.MAX_SAFE_INTEGER;
    const relationshipTypes = options.relationshipTypes || [];
    const direction = options.direction || "outgoing";

    // Validate nodes exist
    if (!this.hasNode(start) || !this.hasNode(end)) {
      return [];
    }

    // Use breadth-first search to find paths
    const queue: { path: NodeId[]; visited: Set<NodeId> }[] = [
      { path: [start], visited: new Set([start]) },
    ];
    const result: NodeId[][] = [];

    while (queue.length > 0) {
      const { path, visited } = queue.shift()!;
      const currentNode = path[path.length - 1];

      // Check if we've reached the target
      if (currentNode === end && path.length > 1) {
        result.push([...path]);
        continue;
      }

      // Check if we've reached maximum depth
      if (path.length > maxDepth) {
        continue;
      }

      // Get neighbors based on direction
      let neighbors: Map<NodeId, Map<string, EdgeData>> | undefined;

      if (direction === "outgoing") {
        neighbors = this.outgoingEdges.get(currentNode);
      } else if (direction === "incoming") {
        neighbors = this.incomingEdges.get(currentNode);
      } else {
        // For 'both', we need to combine outgoing and incoming
        neighbors = new Map();

        const outgoing = this.outgoingEdges.get(currentNode);
        if (outgoing) {
          for (const [targetId, labels] of outgoing.entries()) {
            neighbors.set(targetId, new Map(labels));
          }
        }

        const incoming = this.incomingEdges.get(currentNode);
        if (incoming) {
          for (const [sourceId, labels] of incoming.entries()) {
            if (!neighbors.has(sourceId)) {
              neighbors.set(sourceId, new Map());
            }

            const targetLabels = neighbors.get(sourceId)!;
            for (const [label, data] of labels.entries()) {
              targetLabels.set(label, data);
            }
          }
        }
      }

      if (!neighbors) {
        continue;
      }

      // Explore neighbors
      for (const [neighborId, labels] of neighbors.entries()) {
        // Skip if already visited
        if (visited.has(neighborId)) {
          continue;
        }

        // Check relationship types
        if (relationshipTypes.length > 0) {
          let hasMatchingRelation = false;

          for (const label of labels.keys()) {
            if (relationshipTypes.includes(label)) {
              hasMatchingRelation = true;
              break;
            }
          }

          if (!hasMatchingRelation) {
            continue;
          }
        }

        // Add to queue
        const newPath = [...path, neighborId];
        const newVisited = new Set(visited);
        newVisited.add(neighborId);

        queue.push({ path: newPath, visited: newVisited });
      }
    }

    return result;
  }

  // Graph-wide operations

  /**
   * Clear all nodes and edges from the graph.
   */
  clear(): void {
    this.nodes.clear();
    this.nodeLabels.clear();
    this.outgoingEdges.clear();
    this.incomingEdges.clear();
  }


  /**
   * Convert the graph to a serializable object
   * @returns An object with nodes and edges that can be serialized
   */
  toJSON(): GraphData<NodeData, EdgeData> {
    const nodes = this.getAllNodes().map(({ id, label, data }) => ({ id, label, data }));
    const edges = this.getAllEdges().map(({ source, target, label, data }) => ({ source, target, label, data }));
    return { nodes, edges };
  }

  /**
   * Load the graph from a serialized object
   * @param data The serialized graph data
   */
  fromJSON(data: GraphData<NodeData, EdgeData>): void {
    this.clear();
    for (const { id, label, data: nodeData } of data.nodes) {
      this.addNode(id, label, nodeData);
    }
    for (const { source, target, label, data: edgeData } of data.edges) {
      this.addEdge(source, target, label, edgeData);
    }
  }


  /**
   * Perform a breadth-first traversal of the graph starting from a node
   * @param startNodeId ID of the node to start traversal from
   * @param visitor Visitor that handles traversal events
   * @param options Configuration for the traversal
   */
  traverseBFS(
    startNodeId: NodeId,
    visitor: BFSVisitor<NodeData, EdgeData>,
    options: BFSOptions = {}
  ): void {
    // Default values
    const maxDepth = options.maxDepth || Number.MAX_SAFE_INTEGER;
    const direction = options.direction || "outgoing";
    const trackPaths = options.trackPaths || false;
    const maxResults = options.maxResults || Number.MAX_SAFE_INTEGER;

    // Verify start node exists
    const startNode = this.getNode(startNodeId);
    if (!startNode) {
      return; // Start node doesn't exist
    }

    // Call start callback if provided
    if (visitor.start) {
      visitor.start(startNode);
    }

    // Set up the queue for BFS
    const queue: Array<{
      node: Node<NodeData>;
      depth: number;
      path?: Path<NodeData, EdgeData>;
    }> = [];

    // Start with the initial node
    const initialPath: Path<NodeData, EdgeData> | undefined = trackPaths
      ? { nodes: [startNode], edges: [] }
      : undefined;

    queue.push({
      node: startNode,
      depth: 0,
      path: initialPath
    });

    // Track visited nodes to avoid cycles
    const visited = new Set<NodeId>([startNodeId]);

    // For collecting matching paths if needed
    let resultCount = 0;

    // BFS main loop
    while (queue.length > 0 && resultCount < maxResults) {
      const { node, depth, path } = queue.shift()!;

      // Skip if we've reached max depth
      if (depth > maxDepth) {
        continue;
      }

      // Call discover callback if provided
      let continueTraversal = true;
      if (visitor.discoverNode) {
        continueTraversal = visitor.discoverNode(node, depth, path);
      }

      // Skip traversal from this node if callback returned false
      if (continueTraversal === false) {
        continue;
      }

      // Get edges for this node
      const edges = this.getEdgesForNode(node.id, direction);

      // Process each edge
      for (const edge of edges) {
        // Determine the other node (target or source depending on direction)
        const isOutgoing = edge.source === node.id;
        const otherNodeId = isOutgoing ? edge.target : edge.source;

        // Skip if already visited
        if (visited.has(otherNodeId)) {
          continue;
        }

        const otherNode = this.getNode(otherNodeId);
        if (!otherNode) {
          continue; // Skip if other node doesn't exist
        }

        // Call examine edge callback if provided
        let traverseEdge = true;
        if (visitor.examineEdge) {
          const sourceNode = isOutgoing ? node : otherNode;
          const targetNode = isOutgoing ? otherNode : node;
          traverseEdge = visitor.examineEdge(edge, sourceNode, targetNode, depth);
        }

        // Skip this edge if callback returned false
        if (traverseEdge === false) {
          continue;
        }

        // Create path for the next node if tracking paths
        let newPath: Path<NodeData, EdgeData> | undefined;
        if (trackPaths && path) {
          newPath = {
            nodes: [...path.nodes, otherNode],
            edges: [...path.edges, edge]
          };

          // Call path complete callback if provided
          if (visitor.pathComplete) {
            visitor.pathComplete(newPath, depth + 1);
            resultCount++;
          }
        }

        // Mark as visited and add to queue
        visited.add(otherNodeId);
        queue.push({
          node: otherNode,
          depth: depth + 1,
          path: newPath
        });
      }

      // Call finish node callback if provided
      if (visitor.finishNode) {
        visitor.finishNode(node, depth);
      }
    }
  }

  /**
   * Find all paths from a start node that match a pattern defined by the visitor.
   * 
   * @param startNodeId ID of the node to start search from
   * @param visitor Visitor that defines pattern matching criteria
   * @param options Configuration for the search
   * @returns Array of paths that match the pattern
   */
  findMatchingPaths(
    startNodeId: NodeId,
    visitor: BFSVisitor<NodeData, EdgeData>,
    options: BFSOptions = {}
  ): Path<NodeData, EdgeData>[] {
    // Always track paths for this method
    const searchOptions: BFSOptions = {
      ...options,
      trackPaths: true
    };

    // Create a collector for matching paths
    const matchingPaths: Path<NodeData, EdgeData>[] = [];

    // Create a wrapper visitor that collects paths from the pathComplete callback
    const collectorVisitor: BFSVisitor<NodeData, EdgeData> = {
      // Pass through all callbacks from the original visitor
      start: visitor.start,
      discoverNode: visitor.discoverNode,
      examineEdge: visitor.examineEdge,
      finishNode: visitor.finishNode,

      // Add path collection to pathComplete
      pathComplete: (path: Path<NodeData, EdgeData>, depth: number) => {
        // Call the original pathComplete if provided
        if (visitor.pathComplete) {
          visitor.pathComplete(path, depth);
        }

        // Collect the path
        matchingPaths.push({
          nodes: [...path.nodes],
          edges: [...path.edges]
        });
      }
    };

    // Perform the traversal with the collector visitor
    this.traverseBFS(startNodeId, collectorVisitor, searchOptions);

    return matchingPaths;
  }
}