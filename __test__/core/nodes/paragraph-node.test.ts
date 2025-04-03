// __test__/core/nodes/paragraph-node.test.ts
import { ParagraphNode, NoteNode } from '@/core/nodes';
import { NodeType } from '@/core/types';
import { createParserContext } from '@/parser/parser-context';
import { CannonballGraph } from '@/core/graph';
import { Paragraph, Text, ListItem } from 'mdast';

describe('ParagraphNode', () => {
  let graph: CannonballGraph;
  let paragraph: ParagraphNode;
  let rootNote: NoteNode;

  beforeEach(() => {
    graph = new CannonballGraph();
    rootNote = new NoteNode('test.md', 'Test Note', { filePath: 'test.md' });
    paragraph = new ParagraphNode(
      'test.md#para1',
      'Paragraph 1',
      { filePath: 'test.md' }
    );

    graph.addNode(rootNote);
    graph.addNode(paragraph);
  });

  describe('Constructor and properties', () => {
    it('should create a paragraph node with correct type and properties', () => {
      expect(paragraph.type).toBe(NodeType.Paragraph);
      expect(paragraph.content).toBe('Paragraph 1');
      expect(paragraph.id).toBe('test.md#para1');
      expect(paragraph.metadata.filePath).toBe('test.md');
    });
  });

  describe('Containment rules', () => {
    it('should not allow containing other nodes', () => {
      const otherParagraph = new ParagraphNode('test.md#para2', 'Paragraph 2');
      expect(paragraph.canContain(otherParagraph)).toBe(false);
    });
  });

  describe('AST conversion', () => {
    it('should convert from AST paragraph node', () => {
      const paragraphAst: Paragraph = {
        type: 'paragraph',
        children: [{
          type: 'text',
          value: 'Paragraph from AST'
        }]
      };

      const context = createParserContext('test.md', graph, rootNote);

      const result = ParagraphNode.fromAst(paragraphAst, context, []);

      expect(result).not.toBeNull();
      expect(result?.type).toBe(NodeType.Paragraph);
      expect(result?.content).toBe('Paragraph from AST');
    });

    it('should return null for paragraphs inside list items', () => {
      const paragraphAst: Paragraph = {
        type: 'paragraph',
        children: [{
          type: 'text',
          value: 'Paragraph in list item'
        }]
      };

      const listItemAst: ListItem = {
        type: 'listItem',
        children: [paragraphAst]
      };

      const context = createParserContext('test.md', graph, rootNote);

      // Simulate that the paragraph is inside a list item
      const result = ParagraphNode.fromAst(paragraphAst, context, [listItemAst]);

      expect(result).toBeNull();
    });

    it('should return null for non-paragraph nodes', () => {
      const nonParagraphAst = {
        type: 'heading',
        depth: 1,
        children: []
      };

      const context = createParserContext('test.md', graph, rootNote);

      // @ts-ignore - intentionally testing with wrong type
      const result = ParagraphNode.fromAst(nonParagraphAst, context, []);

      expect(result).toBeNull();
    });

    it('should convert to AST paragraph node', () => {
      const ast = paragraph.toAst() as Paragraph;

      expect(ast.type).toBe('paragraph');
      expect(ast.children.length).toBe(1);

      const text = ast.children[0] as Text;
      expect(text.type).toBe('text');
      expect(text.value).toBe('Paragraph 1');
    });
  });

  describe('canParseAst', () => {
    it('should return true for paragraph nodes', () => {
      const paragraphAst: Paragraph = {
        type: 'paragraph',
        children: []
      };

      expect(ParagraphNode.canParseAst(paragraphAst)).toBe(true);
    });

    it('should return false for non-paragraph nodes', () => {
      const nonParagraphAst = {
        type: 'heading',
        depth: 1,
        children: []
      };

      // @ts-expect-error - intentionally testing with wrong type
      expect(ParagraphNode.canParseAst(nonParagraphAst)).toBe(false);
    });
  });
});