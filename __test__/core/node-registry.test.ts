// __test__/core/node-registry.test.ts
import { NodeRegistry } from '@/core/node-registry';
import { NodeType } from '@/core/types';
import {
  NoteNode, SectionNode, TaskNode, BulletNode,
  ParagraphNode, CodeBlockNode, GenericNode
} from '@/core/nodes';
import { Root, Heading, ListItem, Paragraph, Code } from 'mdast';

describe('NodeRegistry', () => {
  beforeEach(() => {
    // Clear the registry before each test
    NodeRegistry.clear();
  });

  describe('Registration and lookup', () => {
    it('should register and retrieve node classes by type', () => {
      NodeRegistry.register(NodeType.Note, NoteNode);
      NodeRegistry.register(NodeType.Section, SectionNode);

      const retrievedNoteClass = NodeRegistry.getNodeClass(NodeType.Note);
      const retrievedSectionClass = NodeRegistry.getNodeClass(NodeType.Section);

      expect(retrievedNoteClass).toBe(NoteNode);
      expect(retrievedSectionClass).toBe(SectionNode);
    });

    it('should return undefined for unregistered node types', () => {
      const unregisteredType = NodeRegistry.getNodeClass(NodeType.Task);
      expect(unregisteredType).toBeUndefined();
    });
  });

  describe('AST parser registration', () => {
    it('should register and retrieve AST parser classes', () => {
      NodeRegistry.register(NodeType.Note, NoteNode);
      NodeRegistry.register(NodeType.Section, SectionNode);

      const parserClasses = NodeRegistry.getAstParserClasses();

      expect(parserClasses).toContain(NoteNode);
      expect(parserClasses).toContain(SectionNode);
      expect(parserClasses.length).toBe(2);
    });

    it('should not register duplicate classes', () => {
      NodeRegistry.register(NodeType.Note, NoteNode);
      NodeRegistry.register(NodeType.Note, NoteNode);

      const parserClasses = NodeRegistry.getAstParserClasses();

      expect(parserClasses.length).toBe(1);
      expect(parserClasses).toContain(NoteNode);
    });
  });

  describe('Finding parser for AST node', () => {
    beforeEach(() => {
      // Register all node types
      NodeRegistry.register(NodeType.Note, NoteNode);
      NodeRegistry.register(NodeType.Section, SectionNode);
      NodeRegistry.register(NodeType.Task, TaskNode);
      NodeRegistry.register(NodeType.Bullet, BulletNode);
      NodeRegistry.register(NodeType.Paragraph, ParagraphNode);
      NodeRegistry.register(NodeType.CodeBlock, CodeBlockNode);
      NodeRegistry.register(NodeType.Generic, GenericNode);
    });

    it('should find the correct parser for root nodes', () => {
      const rootAst: Root = {
        type: 'root',
        children: []
      };

      const parser = NodeRegistry.findParserForAst(rootAst);
      expect(parser).toBe(NoteNode);
    });

    it('should find the correct parser for heading nodes', () => {
      const headingAst: Heading = {
        type: 'heading',
        depth: 1,
        children: []
      };

      const parser = NodeRegistry.findParserForAst(headingAst);
      expect(parser).toBe(SectionNode);
    });

    it('should find the correct parser for task list items', () => {
      const taskAst: ListItem = {
        type: 'listItem',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'text',
            value: '[ ] Task'
          }]
        }]
      };

      const parser = NodeRegistry.findParserForAst(taskAst);
      expect(parser).toBe(TaskNode);
    });

    it('should find the correct parser for bullet list items', () => {
      const bulletAst: ListItem = {
        type: 'listItem',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'text',
            value: 'Bullet item'
          }]
        }]
      };

      const parser = NodeRegistry.findParserForAst(bulletAst);
      expect(parser).toBe(BulletNode);
    });

    it('should find the correct parser for paragraphs', () => {
      const paragraphAst: Paragraph = {
        type: 'paragraph',
        children: []
      };

      const parser = NodeRegistry.findParserForAst(paragraphAst);
      expect(parser).toBe(ParagraphNode);
    });

    it('should find the correct parser for code blocks', () => {
      const codeAst: Code = {
        type: 'code',
        value: 'code'
      };

      const parser = NodeRegistry.findParserForAst(codeAst);
      expect(parser).toBe(CodeBlockNode);
    });

    it('should find the generic parser for other node types', () => {
      const thematicBreakAst = {
        type: 'thematicBreak'
      };

      const parser = NodeRegistry.findParserForAst(thematicBreakAst as any);
      expect(parser).toBe(GenericNode);
    });

    it('should return undefined if no parser is found', () => {
      // Clear the registry
      NodeRegistry.clear();

      const headingAst: Heading = {
        type: 'heading',
        depth: 1,
        children: []
      };

      const parser = NodeRegistry.findParserForAst(headingAst);
      expect(parser).toBeUndefined();
    });
  });

  describe('Clear registry', () => {
    it('should clear all registrations', () => {
      NodeRegistry.register(NodeType.Note, NoteNode);
      NodeRegistry.register(NodeType.Section, SectionNode);

      expect(NodeRegistry.getNodeClass(NodeType.Note)).toBeDefined();
      expect(NodeRegistry.getAstParserClasses().length).toBe(2);

      NodeRegistry.clear();

      expect(NodeRegistry.getNodeClass(NodeType.Note)).toBeUndefined();
      expect(NodeRegistry.getAstParserClasses().length).toBe(0);
    });
  });
});