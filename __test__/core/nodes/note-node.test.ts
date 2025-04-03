// __test__/core/nodes/note-node.test.ts
import { NoteNode } from '@/core/nodes';
import { NodeType } from '@/core/types';
import { SectionNode, BulletNode, TaskNode } from '@/core/nodes';
import { createParserContext } from '@/parser/parser-context';
import { CannonballGraph } from '@/core/graph';
import { Root, Heading } from 'mdast';

describe('NoteNode', () => {
  let graph: CannonballGraph;
  let noteNode: NoteNode;

  beforeEach(() => {
    graph = new CannonballGraph();
    noteNode = new NoteNode('test.md', 'Test Note', { filePath: 'test.md' });
    graph.addNode(noteNode);
  });

  describe('Constructor and properties', () => {
    it('should create a note node with correct type and properties', () => {
      expect(noteNode.type).toBe(NodeType.Note);
      expect(noteNode.content).toBe('Test Note');
      expect(noteNode.id).toBe('test.md');
      expect(noteNode.metadata.filePath).toBe('test.md');
    });
  });

  describe('Containment rules', () => {
    it('should allow containing sections', () => {
      const section = new SectionNode('test.md#heading1', 'Heading 1', 1);
      expect(noteNode.canContain(section)).toBe(true);
    });

    it('should allow containing bullets', () => {
      const bullet = new BulletNode('test.md#bullet1', 'Bullet 1', 0);
      expect(noteNode.canContain(bullet)).toBe(true);
    });

    it('should allow containing tasks', () => {
      const task = new TaskNode('test.md#task1', 'Task 1');
      expect(noteNode.canContain(task)).toBe(true);
    });

    it('should not allow containing other notes', () => {
      const otherNote = new NoteNode('other.md', 'Other Note');
      expect(noteNode.canContain(otherNote)).toBe(false);
    });
  });

  describe('Containment level', () => {
    it('should have containment level 0', () => {
      expect(noteNode.getContainmentLevel()).toBe(0);
    });
  });

  describe('AST conversion', () => {
    it('should convert from AST root node', () => {
      const rootAst: Root = {
        type: 'root',
        children: []
      };

      // create an empty graph for this test
      graph = new CannonballGraph();

      const context = createParserContext('test.md', graph, noteNode);

      const result = NoteNode.fromAst(rootAst, context, []);

      expect(result).not.toBeNull();
      expect(result?.type).toBe(NodeType.Note);
      expect(result?.content).toBe('test.md');
    });

    it('should return null for non-root AST nodes', () => {
      const nonRootAst = {
        type: 'paragraph',
        children: []
      };

      const context = createParserContext('test.md', graph, noteNode);

      // @ts-ignore - intentionally testing with wrong type
      const result = NoteNode.fromAst(nonRootAst, context, []);

      expect(result).toBeNull();
    });

    it('should convert to AST root node', () => {
      // For a note without .md in the title
      const documentNote = new NoteNode('doc1', 'My Document');
      const ast = documentNote.toAst();

      expect(ast.type).toBe('root');
      expect(ast.children.length).toBe(1);
      expect(ast.children[0].type).toBe('heading');
      expect((ast.children[0] as Heading).depth).toBe(1);
      expect(((ast.children[0] as Heading).children[0] as any).value).toBe('My Document');

      // For a note with .md in the title (filename)
      const fileNote = new NoteNode('file.md', 'file.md');
      const fileAst = fileNote.toAst();

      expect(fileAst.type).toBe('root');
      expect(fileAst.children.length).toBe(0); // No title heading for filenames
    });
  });

  describe('canParseAst', () => {
    it('should return true for root nodes', () => {
      const rootAst: Root = {
        type: 'root',
        children: []
      };

      expect(NoteNode.canParseAst(rootAst)).toBe(true);
    });

    it('should return false for non-root nodes', () => {
      const nonRootAst = {
        type: 'paragraph',
        children: []
      };

      // @ts-ignore - intentionally testing with wrong type
      expect(NoteNode.canParseAst(nonRootAst)).toBe(false);
    });
  });
});