// __test__/parser/parser-context.test.ts
import { createParserContext } from '@/parser/parser-context';
import { CannonballGraph } from '@/core/graph';
import { NoteNode, SectionNode } from '@/core/nodes';
import { NodeType, RelationType } from '@/core/types';
import { Root, Heading } from 'mdast';

describe('ParserContext', () => {
  let graph: CannonballGraph;
  let rootNode: NoteNode;

  beforeEach(() => {
    graph = new CannonballGraph();
    rootNode = new NoteNode('test.md', 'Test Note', { filePath: 'test.md' });
    graph.addNode(rootNode);
  });

  describe('Creation', () => {
    it('should create a context with the correct properties', () => {
      const context = createParserContext('test.md', graph, rootNode);

      expect(context.filePath).toBe('test.md');
      expect(context.graph).toBe(graph);
      expect(context.containerStack).toEqual([rootNode]);
      expect(context.nodeMap).toBeDefined();
      expect(context.nodeMap.size).toBe(0);
    });
  });

  describe('Container stack management', () => {
    it('should get the current container', () => {
      const context = createParserContext('test.md', graph, rootNode);

      expect(context.getCurrentContainer()).toBe(rootNode);

      // Add another container
      const section = new SectionNode('test.md#heading1', 'Heading 1', 1);
      context.containerStack.push(section);

      expect(context.getCurrentContainer()).toBe(section);
    });

    it('should throw when getting current container from empty stack', () => {
      const context = createParserContext('test.md', graph, rootNode);

      // Empty the stack
      context.containerStack = [];

      expect(() => context.getCurrentContainer()).toThrow('Container stack is empty');
    });
  });

  describe('Adding nodes to graph', () => {
    it('should add a node to the graph and create containment relationship', () => {
      const context = createParserContext('test.md', graph, rootNode);

      // Create a new node
      const section = new SectionNode('test.md#heading1', 'Heading 1', 1);

      // Add to graph through context
      context.addNodeToGraph(section);

      // Verify node was added
      expect(graph.getNode(section.id)).toBe(section);

      // Verify containment relationship
      const children = graph.getRelatedNodes(rootNode.id, RelationType.ContainsChild);
      expect(children).toContain(section);
    });

    it('should not create containment relationship if container stack is empty', () => {
      const context = createParserContext('test.md', graph, rootNode);

      // Empty the stack
      context.containerStack = [];

      // Create a new node
      const section = new SectionNode('test.md#heading1', 'Heading 1', 1);

      // Add to graph through context
      context.addNodeToGraph(section);

      // Verify node was added
      expect(graph.getNode(section.id)).toBe(section);

      // Verify no containment relationship was created
      const children = graph.getRelatedNodes(rootNode.id, RelationType.ContainsChild);
      expect(children).not.toContain(section);
    });
  });

  describe('AST to graph node mapping', () => {
    it('should map AST nodes to graph nodes', () => {
      const context = createParserContext('test.md', graph, rootNode);

      // Create AST and graph nodes
      const rootAst: Root = {
        type: 'root',
        children: []
      };

      const headingAst: Heading = {
        type: 'heading',
        depth: 1,
        children: []
      };

      const section = new SectionNode('test.md#heading1', 'Heading 1', 1);

      // Map nodes
      context.mapAstToGraph(rootAst, rootNode);
      context.mapAstToGraph(headingAst, section);

      // Verify mappings
      expect(context.getNodeForAst(rootAst)).toBe(rootNode);
      expect(context.getNodeForAst(headingAst)).toBe(section);
    });

    it('should return undefined for unmapped AST nodes', () => {
      const context = createParserContext('test.md', graph, rootNode);

      const unmappedAst: Heading = {
        type: 'heading',
        depth: 1,
        children: []
      };

      expect(context.getNodeForAst(unmappedAst)).toBeUndefined();
    });

    it('should generate unique IDs for AST nodes with and without positions', () => {
      const context = createParserContext('test.md', graph, rootNode);

      // AST node with position
      const headingWithPos: Heading = {
        type: 'heading',
        depth: 1,
        children: [],
        position: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 10, offset: 9 }
        }
      };

      // AST node without position
      const headingWithoutPos: Heading = {
        type: 'heading',
        depth: 2,
        children: []
      };

      const section1 = new SectionNode('test.md#heading1', 'Heading 1', 1);
      const section2 = new SectionNode('test.md#heading2', 'Heading 2', 2);

      context.mapAstToGraph(headingWithPos, section1);
      context.mapAstToGraph(headingWithoutPos, section2);

      // Verify both mappings work
      expect(context.getNodeForAst(headingWithPos)).toBe(section1);
      expect(context.getNodeForAst(headingWithoutPos)).toBe(section2);
    });
  });
});