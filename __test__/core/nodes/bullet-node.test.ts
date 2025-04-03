// __test__/core/nodes/bullet-node.test.ts
import { BulletNode, TaskNode, NoteNode } from '@/core/nodes';
import { NodeType } from '@/core/types';
import { createParserContext } from '@/parser/parser-context';
import { CannonballGraph } from '@/core/graph';
import { ListItem, Paragraph, Text } from 'mdast';

describe('BulletNode', () => {
  let graph: CannonballGraph;
  let bullet: BulletNode;
  let rootNote: NoteNode;

  beforeEach(() => {
    graph = new CannonballGraph();
    rootNote = new NoteNode('test.md', 'Test Note', { filePath: 'test.md' });
    bullet = new BulletNode(
      'test.md#bullet1',
      'Bullet 1',
      0,
      { filePath: 'test.md' }
    );

    graph.addNode(rootNote);
    graph.addNode(bullet);
  });

  describe('Constructor and properties', () => {
    it('should create a bullet node with correct type and properties', () => {
      expect(bullet.type).toBe(NodeType.Bullet);
      expect(bullet.content).toBe('Bullet 1');
      expect(bullet.indentLevel).toBe(0);
      expect(bullet.id).toBe('test.md#bullet1');
      expect(bullet.metadata.filePath).toBe('test.md');
    });
  });

  describe('Containment rules', () => {
    it('should allow containing tasks', () => {
      const task = new TaskNode('test.md#task1', 'Task 1');
      expect(bullet.canContain(task)).toBe(true);
    });

    it('should allow containing other bullets', () => {
      const subBullet = new BulletNode('test.md#bullet2', 'Bullet 2', 1);
      expect(bullet.canContain(subBullet)).toBe(true);
    });
  });

  describe('Containment level and hierarchy', () => {
    it('should have containment level equal to indent level', () => {
      expect(bullet.getContainmentLevel()).toBe(0);

      const indentedBullet = new BulletNode('test.md#indent', 'Indented Bullet', 2);
      expect(indentedBullet.getContainmentLevel()).toBe(2);
    });

    it('should handle bullet hierarchy correctly', () => {
      const bullet0 = new BulletNode('test.md#bullet0', 'Bullet 0', 0);
      const bullet1 = new BulletNode('test.md#bullet1', 'Bullet 1', 1);
      const bullet2 = new BulletNode('test.md#bullet2', 'Bullet 2', 2);
      const bullet1b = new BulletNode('test.md#bullet1b', 'Bullet 1b', 1);
      const task1 = new TaskNode('test.md#task1', 'Task 1', undefined, 1);

      // Bullet 0 should not be popped for Bullet 1
      expect(bullet0.shouldPopFromContainerStack(bullet1)).toBe(false);

      // Bullet 2 should be popped for Bullet 1b
      expect(bullet2.shouldPopFromContainerStack(bullet1b)).toBe(true);

      // Bullet 1 should not be popped for Bullet 2
      expect(bullet1.shouldPopFromContainerStack(bullet2)).toBe(false);

      // Same level should be popped
      expect(bullet1.shouldPopFromContainerStack(bullet1b)).toBe(true);

      // Test with task nodes
      expect(bullet1.shouldPopFromContainerStack(task1)).toBe(true);
    });

    it('should properly adjust container stack', () => {
      const context = createParserContext('test.md', graph, rootNote);

      // Add bullets of different levels
      const bullet0 = new BulletNode('test.md#bullet0', 'Bullet 0', 0);
      const bullet1 = new BulletNode('test.md#bullet1', 'Bullet 1', 1);
      const bullet2 = new BulletNode('test.md#bullet2', 'Bullet 2', 2);
      const bullet1b = new BulletNode('test.md#bullet1b', 'Bullet 1b', 1);

      // Start with just the root note
      expect(context.containerStack.length).toBe(1);

      // Add Bullet 0
      context.containerStack.push(bullet0);

      // Add Bullet 1
      bullet1.adjustContainerStack(context);
      context.containerStack.push(bullet1);
      expect(context.containerStack).toEqual([rootNote, bullet0, bullet1]);

      // Add Bullet 2
      bullet2.adjustContainerStack(context);
      context.containerStack.push(bullet2);
      expect(context.containerStack).toEqual([rootNote, bullet0, bullet1, bullet2]);

      // Add Bullet 1b - should pop Bullet 2 but keep Bullet 0
      bullet1b.adjustContainerStack(context);
      expect(context.containerStack).toEqual([rootNote, bullet0]);
    });
  });

  describe('AST conversion', () => {
    it('should convert from AST list item node without task marker', () => {
      const bulletAst: ListItem = {
        type: 'listItem',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'text',
            value: 'Bullet from AST'
          }]
        }]
      };

      const context = createParserContext('test.md', graph, rootNote);

      const result = BulletNode.fromAst(bulletAst, context, []);

      expect(result).not.toBeNull();
      expect(result?.type).toBe(NodeType.Bullet);
      expect(result?.content).toBe('Bullet from AST');
    });

    it('should return null for task list items', () => {
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

      const context = createParserContext('test.md', graph, rootNote);

      const result = BulletNode.fromAst(taskAst, context, []);

      expect(result).toBeNull();
    });

    it('should return null for non-list-item nodes', () => {
      const nonListItemAst = {
        type: 'paragraph',
        children: []
      };

      const context = createParserContext('test.md', graph, rootNote);

      // @ts-expect-error - intentionally testing with wrong type
      const result = BulletNode.fromAst(nonListItemAst, context, []);

      expect(result).toBeNull();
    });

    it('should convert to AST list item node', () => {
      const ast = bullet.toAst() as ListItem;

      expect(ast.type).toBe('listItem');
      expect(ast.children.length).toBe(1);
      expect(ast.children[0].type).toBe('paragraph');

      const paragraph = ast.children[0] as Paragraph;
      const text = paragraph.children[0] as Text;
      expect(text.value).toBe('Bullet 1');

      // Should not have checked property
      expect(ast.checked).toBeUndefined();
    });
  });

  describe('canParseAst', () => {
    it('should return true for regular list items', () => {
      const bulletAst: ListItem = {
        type: 'listItem',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'text',
            value: 'Regular bullet'
          }]
        }]
      };

      expect(BulletNode.canParseAst(bulletAst)).toBe(true);
    });

    it('should return false for task list items', () => {
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

      expect(BulletNode.canParseAst(taskAst)).toBe(false);
    });

    it('should return false for non-list-item nodes', () => {
      const nonListItemAst = {
        type: 'paragraph',
        children: []
      };

      // @ts-expect-error - intentionally testing with wrong type
      expect(BulletNode.canParseAst(nonListItemAst)).toBe(false);
    });
  });
});