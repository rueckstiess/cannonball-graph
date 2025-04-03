// __test__/core/nodes/section-node.test.ts
import { SectionNode } from '@/core/nodes';
import { NodeType } from '@/core/types';
import { BulletNode, TaskNode, NoteNode } from '@/core/nodes';
import { createParserContext } from '@/parser/parser-context';
import { CannonballGraph } from '@/core/graph';
import { Heading, Text } from 'mdast';

describe('SectionNode', () => {
  let graph: CannonballGraph;
  let section: SectionNode;
  let rootNote: NoteNode;

  beforeEach(() => {
    graph = new CannonballGraph();
    rootNote = new NoteNode('test.md', 'Test Note', { filePath: 'test.md' });
    section = new SectionNode('test.md#heading1', 'Heading 1', 1, { filePath: 'test.md' });

    graph.addNode(rootNote);
    graph.addNode(section);
  });

  describe('Constructor and properties', () => {
    it('should create a section node with correct type and properties', () => {
      expect(section.type).toBe(NodeType.Section);
      expect(section.content).toBe('Heading 1');
      expect(section.level).toBe(1);
      expect(section.id).toBe('test.md#heading1');
      expect(section.metadata.filePath).toBe('test.md');
    });
  });

  describe('Containment rules', () => {
    it('should allow containing other sections', () => {
      const subSection = new SectionNode('test.md#heading2', 'Heading 2', 2);
      expect(section.canContain(subSection)).toBe(true);
    });

    it('should allow containing bullets', () => {
      const bullet = new BulletNode('test.md#bullet1', 'Bullet 1', 0);
      expect(section.canContain(bullet)).toBe(true);
    });

    it('should allow containing tasks', () => {
      const task = new TaskNode('test.md#task1', 'Task 1');
      expect(section.canContain(task)).toBe(true);
    });
  });

  describe('Containment level and hierarchy', () => {
    it('should have containment level equal to heading level', () => {
      expect(section.getContainmentLevel()).toBe(1);

      const h2 = new SectionNode('test.md#sub', 'Subheading', 2);
      expect(h2.getContainmentLevel()).toBe(2);
    });

    it('should handle section hierarchy correctly', () => {
      const h1 = new SectionNode('test.md#h1', 'H1', 1);
      const h2 = new SectionNode('test.md#h2', 'H2', 2);
      const h3 = new SectionNode('test.md#h3', 'H3', 3);
      const h1b = new SectionNode('test.md#h1b', 'H1b', 1);

      // H1 should not be popped for H2
      expect(h1.shouldPopFromContainerStack(h2)).toBe(false);

      // H2 should be popped for H1b
      expect(h2.shouldPopFromContainerStack(h1b)).toBe(true);

      // H2 should not be popped for H3
      expect(h2.shouldPopFromContainerStack(h3)).toBe(false);

      // Same level should be popped
      expect(h1.shouldPopFromContainerStack(h1b)).toBe(true);
    });

    it('should properly adjust container stack', () => {
      const context = createParserContext('test.md', graph, rootNote);

      // Add sections of different levels
      const h1 = new SectionNode('test.md#h1', 'H1', 1);
      const h2 = new SectionNode('test.md#h2', 'H2', 2);
      const h3 = new SectionNode('test.md#h3', 'H3', 3);
      const h1b = new SectionNode('test.md#h1b', 'H1b', 1);

      // Start with just the root note
      expect(context.containerStack.length).toBe(1);

      // Add H1
      context.containerStack.push(h1);

      // Add H2
      h2.adjustContainerStack(context);
      context.containerStack.push(h2);
      expect(context.containerStack).toEqual([rootNote, h1, h2]);

      // Add H3
      h3.adjustContainerStack(context);
      context.containerStack.push(h3);
      expect(context.containerStack).toEqual([rootNote, h1, h2, h3]);

      // Add another H1 - should pop back to root
      h1b.adjustContainerStack(context);
      expect(context.containerStack).toEqual([rootNote]);
    });
  });

  describe('AST conversion', () => {
    it('should convert from AST heading node', () => {
      const headingAst: Heading = {
        type: 'heading',
        depth: 2,
        children: [{
          type: 'text',
          value: 'Test Heading'
        }]
      };

      const context = createParserContext('test.md', graph, rootNote);

      const result = SectionNode.fromAst(headingAst, context, []);

      expect(result).not.toBeNull();
      expect(result?.type).toBe(NodeType.Section);
      expect(result?.content).toBe('Test Heading');
      expect(result?.level).toBe(2);
    });

    it('should return null for non-heading AST nodes', () => {
      const nonHeadingAst = {
        type: 'paragraph',
        children: []
      };

      const context = createParserContext('test.md', graph, rootNote);

      // @ts-ignore - intentionally testing with wrong type
      const result = SectionNode.fromAst(nonHeadingAst, context, []);

      expect(result).toBeNull();
    });

    it('should convert to AST heading node', () => {
      const ast = section.toAst();

      expect(ast.type).toBe('heading');
      expect(ast.depth).toBe(1);
      expect(ast.children.length).toBe(1);
      expect(ast.children[0].type).toBe('text');
      expect((ast.children[0] as Text).value).toBe('Heading 1');
    });
  });

  describe('canParseAst', () => {
    it('should return true for heading nodes', () => {
      const headingAst: Heading = {
        type: 'heading',
        depth: 2,
        children: []
      };

      expect(SectionNode.canParseAst(headingAst)).toBe(true);
    });

    it('should return false for non-heading nodes', () => {
      const nonHeadingAst = {
        type: 'paragraph',
        children: []
      };

      // @ts-ignore - intentionally testing with wrong type
      expect(SectionNode.canParseAst(nonHeadingAst)).toBe(false);
    });
  });
});