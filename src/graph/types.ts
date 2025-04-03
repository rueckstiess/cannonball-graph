// Types for the Graph component

// Unique identifier for nodes
export type NodeId = string;

// Core node structure
export interface Node<T = any> {
  id: NodeId;
  data: T;
}

// Edge between nodes with a label
export interface Edge<T = any> {
  source: NodeId;
  target: NodeId;
  label: string;
  data: T;
}

// Options for path finding
export interface PathOptions {
  maxDepth?: number;
  relationshipTypes?: string[];
  direction?: 'outgoing' | 'incoming' | 'both';
}

// Serialization format for graph data
export interface GraphData<NodeData = any, EdgeData = any> {
  nodes: Record<NodeId, NodeData>;
  edges: Array<{ source: NodeId, target: NodeId, label: string, data: EdgeData }>;
}

// Main Graph interface
export interface Graph<NodeData = any, EdgeData = any> {
  // Node operations
  addNode(id: NodeId, data: NodeData): void;
  getNode(id: NodeId): Node<NodeData> | undefined;
  hasNode(id: NodeId): boolean;
  updateNode(id: NodeId, data: NodeData): boolean;
  removeNode(id: NodeId): boolean;
  getAllNodes(): Node<NodeData>[];
  findNodes(predicate: (node: Node<NodeData>) => boolean): Node<NodeData>[];

  // Edge operations
  addEdge(source: NodeId, target: NodeId, label: string, data: EdgeData): void;
  getEdge(source: NodeId, target: NodeId, label: string): Edge<EdgeData> | undefined;
  hasEdge(source: NodeId, target: NodeId, label?: string): boolean;
  updateEdge(source: NodeId, target: NodeId, label: string, data: EdgeData): boolean;
  removeEdge(source: NodeId, target: NodeId, label?: string): boolean;
  getAllEdges(): Edge<EdgeData>[];
  findEdges(predicate: (edge: Edge<EdgeData>) => boolean): Edge<EdgeData>[];

  // Traversal operations
  getNeighbors(id: NodeId, direction?: 'outgoing' | 'incoming' | 'both'): Node<NodeData>[];
  getEdgesForNode(id: NodeId, direction?: 'outgoing' | 'incoming' | 'both'): Edge<EdgeData>[];
  findPaths(start: NodeId, end: NodeId, options?: PathOptions): NodeId[][];

  // Graph-wide operations
  clear(): void;
  toJSON(): GraphData<NodeData, EdgeData>;
  fromJSON(data: GraphData<NodeData, EdgeData>): void;
}