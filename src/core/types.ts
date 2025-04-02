// src/core/types.ts
/**
 * Defines the types of nodes in the Cannonball graph
 */
export enum NodeType {
  Generic = 'generic',
  Paragraph = 'paragraph',
  Container = 'container',
  Task = 'task',
  Bullet = 'bullet',
  Note = 'note',
  Section = 'section',
  DailyNote = 'daily_note',
  CodeBlock = 'code_block',
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
 * Interface for a diff of changes to apply to the graph
 */
export interface GraphDiff {
  /** Nodes to add to the graph (as plain objects) */
  addedNodes: Record<string, unknown>[];
  /** IDs of nodes to remove from the graph */
  removedNodeIds: string[];
  /** Edges to add to the graph */
  addedEdges: {
    source: string;
    target: string;
    relation: RelationType;
    metadata: Record<string, unknown>;
  }[];
  /** Edges to remove from the graph */
  removedEdges: {
    source: string;
    target: string;
    relation: RelationType;
  }[];
}