// __test__/core/nodes/task-node.test.ts
import { TaskNode, BulletNode, NoteNode } from '@/core/nodes';
import { NodeType, TaskState } from '@/core/types';
import { createParserContext } from '@/parser/parser-context';
import { CannonballGraph } from '@/core/graph';
import { ListItem, Paragraph, Text } from 'mdast';

describe('TaskNode', () => {
  let graph: CannonballGraph;
  let task: TaskNode;
  let rootNote: NoteNode;

  beforeEach(() => {
    graph = new CannonballGraph();
    rootNote = new NoteNode('test.md', 'Test Note', { filePath: 'test.md' });
    task = new TaskNode(
      'test.md#task1',
      'Task 1',
      TaskState.Open,
      0,
      { filePath: 'test.md' }
    );

    graph.addNode(rootNote);
    graph.addNode(task);
  });

  describe('Constructor and properties', () => {
    it('should create a task node with correct type and properties', () => {
      expect(task.type).toBe(NodeType.Task);
      expect(task.content).toBe('Task 1');
      expect(task.state).toBe(TaskState.Open);
      expect(task.indentLevel).toBe(0);
      expect(task.id).toBe('test.md#task1');
      expect(task.metadata.filePath).toBe('test.md');
    });

    it('should handle different task states', () => {
      const completedTask = new TaskNode(
        'test.md#task2',
        'Completed Task',
        TaskState.Complete
      );

      const inProgressTask = new TaskNode(
        'test.md#task3',
        'In Progress Task',
        TaskState.InProgress
      );

      const blockedTask = new TaskNode(
        'test.md#task4',
        'Blocked Task',
        TaskState.Blocked
      );

      const cancelledTask = new TaskNode(
        'test.md#task5',
        'Cancelled Task',
        TaskState.Cancelled
      );

      expect(completedTask.state).toBe(TaskState.Complete);
      expect(inProgressTask.state).toBe(TaskState.InProgress);
      expect(blockedTask.state).toBe(TaskState.Blocked);
      expect(cancelledTask.state).toBe(TaskState.Cancelled);
    });
  });

  describe('Containment rules', () => {
    it('should allow containing other tasks', () => {
      const subTask = new TaskNode('test.md#subtask', 'Subtask', TaskState.Open, 1);
      expect(task.canContain(subTask)).toBe(true);
    });

    it('should allow containing bullets', () => {
      const bullet = new BulletNode('test.md#bullet1', 'Bullet 1', 1);
      expect(task.canContain(bullet)).toBe(true);
    });
  });

  describe('Containment level and hierarchy', () => {
    it('should have containment level equal to indent level', () => {
      expect(task.getContainmentLevel()).toBe(0);

      const indentedTask = new TaskNode('test.md#indent', 'Indented Task', TaskState.Open, 2);
      expect(indentedTask.getContainmentLevel()).toBe(2);
    });

    it('should handle task hierarchy correctly', () => {
      const task0 = new TaskNode('test.md#task0', 'Task 0', TaskState.Open, 0);
      const task1 = new TaskNode('test.md#task1', 'Task 1', TaskState.Open, 1);
      const task2 = new TaskNode('test.md#task2', 'Task 2', TaskState.Open, 2);
      const task1b = new TaskNode('test.md#task1b', 'Task 1b', TaskState.Open, 1);
      const bullet1 = new BulletNode('test.md#bullet1', 'Bullet 1', 1);

      // Task 0 should not be popped for Task 1
      expect(task0.shouldPopFromContainerStack(task1)).toBe(false);

      // Task 2 should be popped for Task 1b
      expect(task2.shouldPopFromContainerStack(task1b)).toBe(true);

      // Task 1 should not be popped for Task 2
      expect(task1.shouldPopFromContainerStack(task2)).toBe(false);

      // Same level should be popped
      expect(task1.shouldPopFromContainerStack(task1b)).toBe(true);

      // Test with bullet nodes
      expect(task1.shouldPopFromContainerStack(bullet1)).toBe(true);
    });

    it('should properly adjust container stack', () => {
      const context = createParserContext('test.md', graph, rootNote);

      // Add tasks of different levels
      const task0 = new TaskNode('test.md#task0', 'Task 0', TaskState.Open, 0);
      const task1 = new TaskNode('test.md#task1', 'Task 1', TaskState.Open, 1);
      const task2 = new TaskNode('test.md#task2', 'Task 2', TaskState.Open, 2);
      const task1b = new TaskNode('test.md#task1b', 'Task 1b', TaskState.Open, 1);

      // Start with just the root note
      expect(context.containerStack.length).toBe(1);

      // Add Task 0
      context.containerStack.push(task0);

      // Add Task 1
      task1.adjustContainerStack(context);
      context.containerStack.push(task1);
      expect(context.containerStack).toEqual([rootNote, task0, task1]);

      // Add Task 2
      task2.adjustContainerStack(context);
      context.containerStack.push(task2);
      expect(context.containerStack).toEqual([rootNote, task0, task1, task2]);

      // Add Task 1b - should pop Task 2 but keep Task 0
      task1b.adjustContainerStack(context);
      expect(context.containerStack).toEqual([rootNote, task0]);
    });
  });

  describe('AST conversion', () => {
    it('should convert from AST list item node with task marker', () => {
      const taskAst: ListItem = {
        type: 'listItem',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'text',
            value: '[ ] Task from AST'
          }]
        }],
        checked: false
      };

      const context = createParserContext('test.md', graph, rootNote);

      const result = TaskNode.fromAst(taskAst, context, []);

      expect(result).not.toBeNull();
      expect(result?.type).toBe(NodeType.Task);
      expect(result?.content).toBe('Task from AST');
      expect(result?.state).toBe(TaskState.Open);
    });

    it('should convert tasks with different states', () => {
      const createTaskAst = (marker: string): ListItem => ({
        type: 'listItem',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'text',
            value: `[${marker}] Task ${marker}`
          }]
        }],
        checked: marker === 'x'
      });

      const context = createParserContext('test.md', graph, rootNote);

      const openTask = TaskNode.fromAst(createTaskAst(' '), context, []);
      const completedTask = TaskNode.fromAst(createTaskAst('x'), context, []);
      const inProgressTask = TaskNode.fromAst(createTaskAst('/'), context, []);
      const blockedTask = TaskNode.fromAst(createTaskAst('!'), context, []);
      const cancelledTask = TaskNode.fromAst(createTaskAst('-'), context, []);

      expect(openTask?.state).toBe(TaskState.Open);
      expect(completedTask?.state).toBe(TaskState.Complete);
      expect(inProgressTask?.state).toBe(TaskState.InProgress);
      expect(blockedTask?.state).toBe(TaskState.Blocked);
      expect(cancelledTask?.state).toBe(TaskState.Cancelled);
    });

    it('should return null for non-task list items', () => {
      const nonTaskAst: ListItem = {
        type: 'listItem',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'text',
            value: 'Regular list item'
          }]
        }]
      };

      const context = createParserContext('test.md', graph, rootNote);

      const result = TaskNode.fromAst(nonTaskAst, context, []);

      expect(result).toBeNull();
    });

    it('should convert to AST list item node with correct task marker', () => {
      // Test different task states
      const openTask = new TaskNode('test.md#open', 'Open Task', TaskState.Open);
      const completedTask = new TaskNode('test.md#done', 'Done Task', TaskState.Complete);
      const inProgressTask = new TaskNode('test.md#progress', 'In Progress Task', TaskState.InProgress);
      const blockedTask = new TaskNode('test.md#blocked', 'Blocked Task', TaskState.Blocked);
      const cancelledTask = new TaskNode('test.md#cancelled', 'Cancelled Task', TaskState.Cancelled);

      const openAst = openTask.toAst() as ListItem;
      const completedAst = completedTask.toAst() as ListItem;
      const inProgressAst = inProgressTask.toAst() as ListItem;
      const blockedAst = blockedTask.toAst() as ListItem;
      const cancelledAst = cancelledTask.toAst() as ListItem;

      // Check basics
      expect(openAst.type).toBe('listItem');
      expect(openAst.children.length).toBe(1);
      expect(openAst.children[0].type).toBe('paragraph');

      // Check markers
      const getText = (ast: ListItem): string => {
        const paragraph = ast.children[0] as Paragraph;
        return paragraph.children.map(c => (c as Text).value).join('');
      };

      expect(getText(openAst)).toContain('[ ]');
      expect(getText(completedAst)).toContain('[x]');
      expect(getText(inProgressAst)).toContain('[/]');
      expect(getText(blockedAst)).toContain('[!]');
      expect(getText(cancelledAst)).toContain('[-]');

      // Check content
      expect(getText(openAst)).toContain('Open Task');
      expect(getText(completedAst)).toContain('Done Task');

      // Check checked property
      expect(completedAst.checked).toBe(true);
      expect(openAst.checked).toBe(false);
    });
  });

  describe('canParseAst', () => {
    it('should return true for list items with task markers', () => {
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

      expect(TaskNode.canParseAst(taskAst)).toBe(true);
    });

    it('should return false for regular list items', () => {
      const nonTaskAst: ListItem = {
        type: 'listItem',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'text',
            value: 'Regular list item'
          }]
        }]
      };

      expect(TaskNode.canParseAst(nonTaskAst)).toBe(false);
    });

    it('should return false for non-list-item nodes', () => {
      const nonListItemAst = {
        type: 'paragraph',
        children: []
      };

      // @ts-expect-error - intentionally testing with wrong type
      expect(TaskNode.canParseAst(nonListItemAst)).toBe(false);
    });
  });
});