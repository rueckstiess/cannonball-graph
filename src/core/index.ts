// src/core/index.ts
// Export core types
export {
  NodeType,
  RelationType,
  TaskState,
  type GraphDiff,
} from './types';

// Export core classes
export { CannonballGraph, type Edge } from './graph';

// Export node classes
export {
  BaseNode,
  ContainerNode,
  ContentNode,
  NodeFactory
} from './node';

// Export specific node implementations
export {
  NoteNode,
  SectionNode,
  TaskNode,
  BulletNode,
  ParagraphNode,
  CodeBlockNode,
  GenericNode
} from './nodes';

// Export registry
export { NodeRegistry, type NodeClassConstructor } from './node-registry';
export { initializeNodeRegistry } from './registry-init';

// Export AST conversion interface
export { type AstConvertible, getAstNodeId } from './ast-convertible';