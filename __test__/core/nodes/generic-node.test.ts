// __test__/core/nodes/generic-node.test.ts
import { GenericNode, NoteNode } from '@/core/nodes';
import { NodeType } from '@/core/types';
import { createParserContext } from '@/parser/parser-context';
import { CannonballGraph } from '@/core/graph';
import { Paragraph, Heading, ThematicBreak } from 'mdast';

describe('GenericNode', () => {
  let graph: CannonballGraph;
  let genericNode: GenericNode;
  let rootNote: NoteNode;

  beforeEach(() => {
    graph = new CannonballGraph();
    rootNote = new NoteNode('test.md', 'Test Note', { filePath: 'test.md' });
    genericNode = new GenericNode(
      'test.md#generic1',
      'Generic Content',
      {
        filePath: 'test.md',
        nodeType: 'thematicBreak'
      }
    );

    graph.addNode(rootNote);
    graph.addNode(genericNode);
  });

  describe('Constructor and properties', () => {
    it('should create a generic node with correct type and properties', () => {
      expect(genericNode.type).toBe(NodeType.Generic);
      expect(genericNode.content).toBe('Generic Content');
      expect(genericNode.id).toBe('test.md#generic1');
      expect(genericNode.metadata.filePath).toBe('test.md');
      expect(genericNode.metadata.nodeType).toBe('thematicBreak');
    });
  });

  describe('Containment rules', () => {
    it('should not allow containing other nodes', () => {
      const otherNode = new GenericNode('test.md#generic2', 'Other Content');
      expect(genericNode.canContain(otherNode)).toBe(false);
    });
  });

  describe('AST conversion', () => {
    it('should convert from AST thematic break node', () => {
      const thematicBreakAst: ThematicBreak = {
        type: 'thematicBreak'
      };

      const context = createParserContext('test.md', graph, rootNote);

      const result = GenericNode.fromAst(thematicBreakAst, context, []);

      expect(result).not.toBeNull();
      expect(result?.type).toBe(NodeType.Generic);
      expect(result?.content).toBe('[thematicBreak]');
      expect(result?.metadata.nodeType).toBe('thematicBreak');
    });

    it('should return null for handled node types', () => {
      // Test with heading (which has its own node type)
      const headingAst: Heading = {
        type: 'heading',
        depth: 1,
        children: []
      };

      const context = createParserContext('test.md', graph, rootNote);

      const result = GenericNode.fromAst(headingAst, context, []);

      expect(result).toBeNull();

      // Test with paragraph (which has its own node type)
      const paragraphAst: Paragraph = {
        type: 'paragraph',
        children: []
      };

      const paragraphResult = GenericNode.fromAst(paragraphAst, context, []);

      expect(paragraphResult).toBeNull();
    });

    it('should convert to AST paragraph node', () => {
      const ast = genericNode.toAst() as Paragraph;

      expect(ast.type).toBe('paragraph');
      expect(ast.children.length).toBe(1);
      expect(ast.children[0].type).toBe('text');
      expect((ast.children[0] as any).value).toBe('Generic Content');
    });
  });

  describe('canParseAst', () => {
    it('should return true for non-standard node types', () => {
      const thematicBreakAst: ThematicBreak = {
        type: 'thematicBreak'
      };

      expect(GenericNode.canParseAst(thematicBreakAst)).toBe(true);
    });

    it('should return false for standard node types', () => {
      // Test with nodes that have specific handlers
      const headingAst: Heading = {
        type: 'heading',
        depth: 1,
        children: []
      };

      expect(GenericNode.canParseAst(headingAst)).toBe(false);

      const paragraphAst: Paragraph = {
        type: 'paragraph',
        children: []
      };

      expect(GenericNode.canParseAst(paragraphAst)).toBe(false);
    });
  });
});