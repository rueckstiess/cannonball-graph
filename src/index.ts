// src/index.ts
// Export core types
export {
  NodeType,
  RelationType,
  TaskState,
  type GraphDiff,
} from './core/types';

// Export core classes
export { CannonballGraph, type Edge } from './core/graph';

// Export node classes
export {
  BaseNode,
  ContainerNode,
  NoteNode,
  SectionNode,
  TaskNode,
  BulletNode,
  ContentNode,
  ParagraphNode,
  CodeBlockNode,
  GenericNode,
  NodeFactory
} from './core/node';

// Export parser and serializer
export { MarkdownParser } from './parser/markdown-parser';
export {
  MarkdownSerializer,
  type SerializationOptions,
  type SerializationResult
} from './parser/markdown-serializer';

// Export utilities
export { generateNodeId, parseNodeId, isNodeInFile } from './utils/id-utils';
export { capitalize, slugify } from './utils/string-utils';