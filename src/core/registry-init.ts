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

export function initializeNodeRegistry(): void {
  // Simply register each node class - no type casting needed
  NodeRegistry.register(NodeType.Note, NoteNode);
  NodeRegistry.register(NodeType.Section, SectionNode);
  NodeRegistry.register(NodeType.Task, TaskNode);
  NodeRegistry.register(NodeType.Bullet, BulletNode);
  NodeRegistry.register(NodeType.Paragraph, ParagraphNode);
  NodeRegistry.register(NodeType.CodeBlock, CodeBlockNode);
  NodeRegistry.register(NodeType.Generic, GenericNode);
}