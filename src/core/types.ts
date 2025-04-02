// src/core/types.ts
/**
 * Defines the types of nodes in the Cannonball graph
 */
export enum NodeType {
  Generic = 'generic',
  Container = 'container',
  Task = 'task',
  Bullet = 'bullet',
  Note = 'note',
  Section = 'section',
  DailyNote = 'daily_note',
}

/**
 * Defines the types of relationships between nodes in the Cannonball graph
 */
export enum RelationType {
  ContainsChild = 'contains',
  LinksTo = 'links_to',
  LinksFrom = 'links_from',
  DependsOn = 'depends_on',
  RelatesTo = 'relates_to',
  DoneBefore = 'done_before',
  DoneAfter = 'done_after',
  BlockedBy = 'blocked_by',
}

/**
 * Defines the possible states of a task
 */
export enum TaskState {
  Open = 'open',
  InProgress = 'in_progress',
  Complete = 'complete',
  Blocked = 'blocked',
  Cancelled = 'cancelled',
}

/**
 * Base interface for all nodes in the Cannonball graph
 */
export interface Node {
  /** Unique path-based identifier for the node */
  id: string;
  /** Type of the node */
  type: NodeType;
  /** Main content of the node */
  content: string;
  /** Additional metadata for the node */
  metadata: Record<string, unknown>;
  /** When the node was created */
  createdDate: Date;
  /** When the node was last modified */
  modifiedDate: Date;
}

/**
 * Interface for nodes that can be resolved (e.g., tasks, questions)
 */
export interface ResolvableNode extends Node {
  /** Whether the node has been resolved */
  resolved: boolean;
}

/**
 * Interface for task nodes
 */
export interface TaskNode extends ResolvableNode {
  /** The current state of the task */
  state: TaskState;
  /** Optional time estimate for the task (in minutes) */
  estimate?: number;
}

/**
 * Interface for container nodes
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ContainerNode extends Node {
  // Container-specific properties can be added here
}

/**
 * Interface for an edge in the Cannonball graph
 */
export interface Edge {
  /** ID of the source node */
  source: string;
  /** ID of the target node */
  target: string;
  /** Type of relationship between the nodes */
  relation: RelationType;
  /** Additional metadata for the edge */
  metadata: Record<string, unknown>;
}

/**
 * Interface for a diff of changes to apply to the graph
 */
export interface GraphDiff {
  /** Nodes to add to the graph */
  addedNodes: Node[];
  /** IDs of nodes to remove from the graph */
  removedNodeIds: string[];
  /** Edges to add to the graph */
  addedEdges: Edge[];
  /** Edges to remove from the graph */
  removedEdges: Edge[];
}