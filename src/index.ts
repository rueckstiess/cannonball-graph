// src/index.ts
// Export core types
export {
  NodeType,
  RelationType,
  TaskState,
  type Node,
  type Edge,
  type ResolvableNode,
  type TaskNode,
  type ContainerNode,
  type GraphDiff,
} from './core/types';

// Export core classes
export { CannonballGraph } from './core/graph';

// Export utilities
export { generateNodeId, parseNodeId, isNodeInFile } from './utils/id-utils';
export { capitalize, slugify } from './utils/string-utils';

// This will be expanded as we implement more components