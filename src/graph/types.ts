// Types for the Graph component

// Unique identifier for nodes
export type NodeId = string;

/**
 * Core node structure in the graph
 * @template T Type of data associated with the node
 */
export interface Node<T = any> {
  /** Unique identifier for the node */
  id: NodeId;
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

/**
 * Options for path finding between nodes
 */
export interface PathOptions {
  /** Maximum number of hops in the path */
  maxDepth?: number;
  /** Filter paths to only include these relationship types */
  relationshipTypes?: string[];
  /** Direction to traverse: outgoing (source->target), incoming (target->source), or both */
  direction?: "outgoing" | "incoming" | "both";
}

/**
 * Serialization format for graph data
 * @template NodeData Type of data associated with nodes
 * @template EdgeData Type of data associated with edges
 */
export interface GraphData<NodeData = any, EdgeData = any> {
  /** Map of node IDs to their data */
  nodes: Record<NodeId, NodeData>;
  /** Array of edges with their data */
  edges: Array<{
    source: NodeId;
    target: NodeId;
    label: string;
    data: EdgeData;
  }>;
}

/**
 * Main Graph interface defining operations on a directed, labeled graph
 * @template NodeData Type of data associated with nodes
 * @template EdgeData Type of data associated with edges
 */
export interface Graph<NodeData = any, EdgeData = any> {
  // Node operations

  /**
   * Add a node to the graph
   * @param id Unique identifier for the node
   * @param data Data to associate with the node
   * @throws Error if a node with the same ID already exists
   */
  addNode(id: NodeId, data: NodeData): void;

  /**
   * Get a node by its ID
   * @param id The node ID to look up
   * @returns The node object or undefined if not found
   */
  getNode(id: NodeId): Node<NodeData> | undefined;

  /**
   * Check if a node exists in the graph
   * @param id The node ID to check
   * @returns True if the node exists, false otherwise
   */
  hasNode(id: NodeId): boolean;

  /**
   * Update a node's data
   * @param id The ID of the node to update
   * @param data The new data to associate with the node
   * @returns True if the node was updated, false if it doesn't exist
   */
  updateNode(id: NodeId, data: NodeData): boolean;

  /**
   * Remove a node and all its connected edges
   * @param id The ID of the node to remove
   * @returns True if the node was removed, false if it doesn't exist
   */
  removeNode(id: NodeId): boolean;

  /**
   * Get all nodes in the graph
   * @returns Array of all nodes
   */
  getAllNodes(): Node<NodeData>[];

  /**
   * Find nodes that match a predicate
   * @param predicate Function that tests each node
   * @returns Array of nodes that satisfy the predicate
   */
  findNodes(predicate: (node: Node<NodeData>) => boolean): Node<NodeData>[];

  // Edge operations

  /**
   * Add an edge between two nodes
   * @param source ID of the source node
   * @param target ID of the target node
   * @param label Type or category of the relationship
   * @param data Data to associate with the edge
   * @throws Error if either node doesn't exist or the edge already exists
   */
  addEdge(source: NodeId, target: NodeId, label: string, data: EdgeData): void;

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
  ): Edge<EdgeData> | undefined;

  /**
   * Check if an edge exists
   * @param source ID of the source node
   * @param target ID of the target node
   * @param label Optional label to check. If not provided, checks if any edge exists between source and target.
   * @returns True if the edge exists, false otherwise
   */
  hasEdge(source: NodeId, target: NodeId, label?: string): boolean;

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
  ): boolean;

  /**
   * Remove an edge from the graph
   * @param source ID of the source node
   * @param target ID of the target node
   * @param label Optional label to specify which edge to remove. If not provided, removes all edges between source and target.
   * @returns True if any edge was removed, false otherwise
   */
  removeEdge(source: NodeId, target: NodeId, label?: string): boolean;

  /**
   * Get all edges in the graph
   * @returns Array of all edges
   */
  getAllEdges(): Edge<EdgeData>[];

  /**
   * Find edges that match a predicate
   * @param predicate Function that tests each edge
   * @returns Array of edges that satisfy the predicate
   */
  findEdges(predicate: (edge: Edge<EdgeData>) => boolean): Edge<EdgeData>[];

  // Traversal operations

  /**
   * Get all neighbor nodes of a node
   * @param id The ID of the node
   * @param direction Which edges to follow: outgoing, incoming, or both
   * @returns Array of neighbor nodes
   */
  getNeighbors(
    id: NodeId,
    direction?: "outgoing" | "incoming" | "both",
  ): Node<NodeData>[];

  /**
   * Get all edges connected to a node
   * @param id The ID of the node
   * @param direction Which edges to include: outgoing, incoming, or both
   * @returns Array of connected edges
   */
  getEdgesForNode(
    id: NodeId,
    direction?: "outgoing" | "incoming" | "both",
  ): Edge<EdgeData>[];

  /**
   * Find paths between two nodes
   * @param start ID of the start node
   * @param end ID of the end node
   * @param options Configuration for path finding
   * @returns Array of paths, where each path is an array of node IDs
   */
  findPaths(start: NodeId, end: NodeId, options?: PathOptions): NodeId[][];

  // Graph-wide operations

  /**
   * Clear all nodes and edges from the graph
   */
  clear(): void;

  /**
   * Convert the graph to a serializable object
   * @returns An object with nodes and edges that can be serialized
   */
  toJSON(): GraphData<NodeData, EdgeData>;

  /**
   * Load the graph from a serialized object
   * @param data The serialized graph data
   */
  fromJSON(data: GraphData<NodeData, EdgeData>): void;
}
