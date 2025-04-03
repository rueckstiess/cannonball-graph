// __test__/core/ast-convertible.test.ts
import { getAstNodeId } from '@/utils/mdast-utils';
import { Heading, Paragraph, Root } from 'mdast';

describe('AST Convertible Utilities', () => {
  describe('getAstNodeId', () => {
    it('should generate IDs based on node type and position', () => {
      const headingAst: Heading = {
        type: 'heading',
        depth: 1,
        children: [],
        position: {
          start: { line: 10, column: 1, offset: 100 },
          end: { line: 10, column: 20, offset: 119 }
        }
      };

      const id = getAstNodeId(headingAst);

      expect(id).toBe('heading-10-1');
    });

    it('should generate different IDs for different AST nodes', () => {
      const heading1: Heading = {
        type: 'heading',
        depth: 1,
        children: [],
        position: {
          start: { line: 10, column: 1, offset: 100 },
          end: { line: 10, column: 20, offset: 119 }
        }
      };

      const heading2: Heading = {
        type: 'heading',
        depth: 2,
        children: [],
        position: {
          start: { line: 15, column: 1, offset: 200 },
          end: { line: 15, column: 20, offset: 219 }
        }
      };

      const paragraph: Paragraph = {
        type: 'paragraph',
        children: [],
        position: {
          start: { line: 10, column: 1, offset: 100 },
          end: { line: 10, column: 20, offset: 119 }
        }
      };

      const id1 = getAstNodeId(heading1);
      const id2 = getAstNodeId(heading2);
      const id3 = getAstNodeId(paragraph);

      // Different positions should give different IDs
      expect(id1).not.toBe(id2);

      // Same position but different types should give different IDs
      expect(id1).not.toBe(id3);
    });

    it('should generate a unique ID for nodes without position', () => {
      const rootAst: Root = {
        type: 'root',
        children: []
      };

      const id = getAstNodeId(rootAst);

      // Should contain the type and a unique string
      expect(id).toContain('root-');

      // Generate another ID to ensure they're the same
      const id2 = getAstNodeId(rootAst);
      expect(id).toBe(id2);
    });
  });
});