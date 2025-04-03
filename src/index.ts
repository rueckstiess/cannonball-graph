// src/index.ts
// Export core types and classes
export {
  NodeType,
  RelationType,
  TaskState,
  type GraphDiff,
  CannonballGraph,
  type Edge,
  BaseNode,
  ContainerNode,
  ContentNode,
  NodeFactory,
  NoteNode,
  SectionNode,
  TaskNode,
  BulletNode,
  ParagraphNode,
  CodeBlockNode,
  GenericNode,
  NodeRegistry,
  initializeNodeRegistry
} from './core';

// Export parser and serializer
export {
  MarkdownParser,
  MarkdownSerializer,
  type SerializationOptions,
  type SerializationResult
} from './parser';

// Export utilities
export { generateNodeId, parseNodeId, isNodeInFile } from './utils/id-utils';
export { capitalize, slugify, normalizeMarkdown } from './utils/string-utils';
export {
  extractInnerText,
  isTaskListItem,
  calculateIndentLevel,
  getTaskState
} from './utils/mdast-utils';