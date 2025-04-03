// __test__/core/registry-init.test.ts
import { NodeRegistry } from '@/core/node-registry';
import { NodeType } from '@/core/types';
import {
  NoteNode, SectionNode, TaskNode, BulletNode,
  ParagraphNode, CodeBlockNode, GenericNode
} from '@/core/nodes';
import { initializeNodeRegistry } from '@/core/registry-init';

describe('Registry Initialization', () => {
  beforeEach(() => {
    // Clear the registry before each test
    NodeRegistry.clear();
  });

  it('should register all node types', () => {
    // Initialize the registry
    initializeNodeRegistry();

    // Check if all node types are registered
    expect(NodeRegistry.getNodeClass(NodeType.Note)).toBe(NoteNode);
    expect(NodeRegistry.getNodeClass(NodeType.Section)).toBe(SectionNode);
    expect(NodeRegistry.getNodeClass(NodeType.Task)).toBe(TaskNode);
    expect(NodeRegistry.getNodeClass(NodeType.Bullet)).toBe(BulletNode);
    expect(NodeRegistry.getNodeClass(NodeType.Paragraph)).toBe(ParagraphNode);
    expect(NodeRegistry.getNodeClass(NodeType.CodeBlock)).toBe(CodeBlockNode);
    expect(NodeRegistry.getNodeClass(NodeType.Generic)).toBe(GenericNode);
  });

  it('should register all AST parser classes', () => {
    // Initialize the registry
    initializeNodeRegistry();

    // Get all AST parser classes
    const parserClasses = NodeRegistry.getAstParserClasses();

    // Check if all classes are registered
    expect(parserClasses).toContain(NoteNode);
    expect(parserClasses).toContain(SectionNode);
    expect(parserClasses).toContain(TaskNode);
    expect(parserClasses).toContain(BulletNode);
    expect(parserClasses).toContain(ParagraphNode);
    expect(parserClasses).toContain(CodeBlockNode);
    expect(parserClasses).toContain(GenericNode);

    // Check total count
    expect(parserClasses.length).toBe(7);
  });
});