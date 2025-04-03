// src/core/registry-init.ts
import { NodeRegistry } from './node-registry';
import { NodeType } from './types';
import {
  NoteNode,
  SectionNode,
  TaskNode,
  BulletNode,
  ParagraphNode,
  CodeBlockNode,
  GenericNode
} from './nodes';

/**
 * Initialize the node registry with all node types
 * This should be called before using the parser or serializer
 */
export function initializeNodeRegistry(): void {
  // Register node classes for AST parsing
  NodeRegistry.register(NodeType.Note, NoteNode);
  NodeRegistry.register(NodeType.Section, SectionNode);
  NodeRegistry.register(NodeType.Task, TaskNode);
  NodeRegistry.register(NodeType.Bullet, BulletNode);
  NodeRegistry.register(NodeType.Paragraph, ParagraphNode);
  NodeRegistry.register(NodeType.CodeBlock, CodeBlockNode);
  NodeRegistry.register(NodeType.Generic, GenericNode);
}

// Auto-initialize on import (can be disabled for testing)
initializeNodeRegistry();