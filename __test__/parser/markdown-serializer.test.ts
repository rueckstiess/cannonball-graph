// __test__/parser/markdown-serializer.test.ts
import { MarkdownParser } from '@/parser/markdown-parser';
import { MarkdownSerializer } from '@/parser/markdown-serializer';
import { CannonballGraph } from '@/core/graph';
import { NodeType, RelationType, TaskState } from '@/core/types';
import { NodeRegistry } from '@/core/node-registry';
import { initializeNodeRegistry } from '@/core/registry-init';
import {
  NoteNode,
  SectionNode,
  TaskNode,
  BulletNode,
  ParagraphNode,
  CodeBlockNode
} from '@/core/nodes';

describe('MarkdownSerializer', () => {
  let parser: MarkdownParser;
  let serializer: MarkdownSerializer;
  let graph: CannonballGraph;

  beforeEach(() => {
    // Reset the registry and re-initialize before each test
    NodeRegistry.clear();
    initializeNodeRegistry();

    parser = new MarkdownParser();
    graph = new CannonballGraph();
    serializer = new MarkdownSerializer(graph);
  });

  describe('Basic serialization', () => {
    it('should serialize an empty graph', () => {
      const result = serializer.serialize();
      expect(result.markdown).toBe('');
      expect(result.ast.children.length).toBe(0);
      expect(result.serializedNodes.length).toBe(0);
    });

    it('should serialize a simple note', () => {
      const note = new NoteNode('test.md', 'Test Note');
      graph.addNode(note);

      const result = serializer.serialize();
      expect(result.markdown).toContain('# Test Note');
      expect(result.serializedNodes).toContain(note);
    });

    it('should serialize a note with a paragraph', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const paragraph = new ParagraphNode('test.md#p1', 'This is a paragraph.');

      graph.addNode(note);
      graph.addNode(paragraph);
      graph.addEdge({
        source: note.id,
        target: paragraph.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      const result = serializer.serialize();
      expect(result.markdown).toContain('# Test Note');
      expect(result.markdown).toContain('This is a paragraph.');
      expect(result.serializedNodes).toContain(note);
      expect(result.serializedNodes).toContain(paragraph);
    });
  });

  describe('Sections', () => {
    it('should serialize sections with proper hierarchy', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const section1 = new SectionNode('test.md#section1', 'Section 1', 1);
      const section2 = new SectionNode('test.md#section2', 'Section 2', 2);
      const section3 = new SectionNode('test.md#section3', 'Section 3', 2);
      const section4 = new SectionNode('test.md#section4', 'Section 4', 1);

      graph.addNode(note);
      graph.addNode(section1);
      graph.addNode(section2);
      graph.addNode(section3);
      graph.addNode(section4);

      // Add containment relationships
      graph.addEdge({
        source: note.id,
        target: section1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: section1.id,
        target: section2.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: section1.id,
        target: section3.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: note.id,
        target: section4.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      const result = serializer.serialize();

      // Check the structure of the markdown
      const lines = result.markdown.split('\n').filter(line => line.trim());
      expect(lines[0]).toBe('# Test Note');
      expect(lines[1]).toBe('# Section 1');
      expect(lines[2]).toBe('## Section 2');
      expect(lines[3]).toBe('## Section 3');
      expect(lines[4]).toBe('# Section 4');

      // Check that all nodes were serialized
      expect(result.serializedNodes).toContain(note);
      expect(result.serializedNodes).toContain(section1);
      expect(result.serializedNodes).toContain(section2);
      expect(result.serializedNodes).toContain(section3);
      expect(result.serializedNodes).toContain(section4);
    });

    it('should serialize paragraphs within sections', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const section = new SectionNode('test.md#section1', 'Section 1', 1);
      const paragraph = new ParagraphNode('test.md#p1', 'This is a paragraph.');

      graph.addNode(note);
      graph.addNode(section);
      graph.addNode(paragraph);

      graph.addEdge({
        source: note.id,
        target: section.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: section.id,
        target: paragraph.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      const result = serializer.serialize();

      // Check the structure of the markdown
      const lines = result.markdown.split('\n').filter(line => line.trim());
      expect(lines[0]).toBe('# Test Note');
      expect(lines[1]).toBe('# Section 1');
      expect(lines[2]).toBe('This is a paragraph.');
    });
  });

  describe('Tasks and bullets', () => {
    it('should serialize a simple task list', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const task1 = new TaskNode('test.md#task1', 'Task 1', TaskState.Open);
      const task2 = new TaskNode('test.md#task2', 'Task 2', TaskState.Complete);

      graph.addNode(note);
      graph.addNode(task1);
      graph.addNode(task2);

      graph.addEdge({
        source: note.id,
        target: task1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: note.id,
        target: task2.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      const result = serializer.serialize();

      expect(result.markdown).toContain('# Test Note');
      expect(result.markdown).toContain('- [ ] Task 1');
      expect(result.markdown).toContain('- [x] Task 2');
    });

    it('should serialize nested task lists', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const task1 = new TaskNode('test.md#task1', 'Task 1', TaskState.Open, 0);
      const task1_1 = new TaskNode('test.md#task1_1', 'Subtask 1.1', TaskState.Open, 1);
      const task1_2 = new TaskNode('test.md#task1_2', 'Subtask 1.2', TaskState.Complete, 1);

      graph.addNode(note);
      graph.addNode(task1);
      graph.addNode(task1_1);
      graph.addNode(task1_2);

      graph.addEdge({
        source: note.id,
        target: task1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: task1.id,
        target: task1_1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: task1.id,
        target: task1_2.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      const result = serializer.serialize();

      expect(result.markdown).toContain('# Test Note');
      expect(result.markdown).toContain('- [ ] Task 1');
      expect(result.markdown).toContain('  - [ ] Subtask 1.1');
      expect(result.markdown).toContain('  - [x] Subtask 1.2');
    });

    it('should serialize mixed bullets and tasks', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const bullet1 = new BulletNode('test.md#bullet1', 'Bullet 1', 0);
      const task1 = new TaskNode('test.md#task1', 'Task 1', TaskState.Open, 1);
      const bullet1_1 = new BulletNode('test.md#bullet1_1', 'Bullet 1.1', 1);

      graph.addNode(note);
      graph.addNode(bullet1);
      graph.addNode(task1);
      graph.addNode(bullet1_1);

      graph.addEdge({
        source: note.id,
        target: bullet1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: bullet1.id,
        target: task1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: note.id,
        target: bullet1_1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      const result = serializer.serialize();

      expect(result.markdown).toContain('# Test Note');
      expect(result.markdown).toContain('- Bullet 1');
      expect(result.markdown).toContain('  - [ ] Task 1');
      expect(result.markdown).toContain('- Bullet 1.1');
    });

    it('should serialize tasks with all states', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const task1 = new TaskNode('test.md#task1', 'Open Task', TaskState.Open);
      const task2 = new TaskNode('test.md#task2', 'Complete Task', TaskState.Complete);
      const task3 = new TaskNode('test.md#task3', 'In Progress Task', TaskState.InProgress);
      const task4 = new TaskNode('test.md#task4', 'Blocked Task', TaskState.Blocked);
      const task5 = new TaskNode('test.md#task5', 'Cancelled Task', TaskState.Cancelled);

      graph.addNode(note);
      graph.addNode(task1);
      graph.addNode(task2);
      graph.addNode(task3);
      graph.addNode(task4);
      graph.addNode(task5);

      graph.addEdge({
        source: note.id,
        target: task1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: note.id,
        target: task2.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: note.id,
        target: task3.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: note.id,
        target: task4.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: note.id,
        target: task5.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      const result = serializer.serialize();

      expect(result.markdown).toContain('- [ ] Open Task');
      expect(result.markdown).toContain('- [x] Complete Task');
      expect(result.markdown).toContain('- [/] In Progress Task');
      expect(result.markdown).toContain('- [!] Blocked Task');
      expect(result.markdown).toContain('- [-] Cancelled Task');
    });
  });

  describe('Code blocks', () => {
    it('should serialize code blocks correctly', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const codeBlock = new CodeBlockNode(
        'test.md#code1',
        'function hello() {\n  console.log("Hello!");\n}',
        'javascript'
      );

      graph.addNode(note);
      graph.addNode(codeBlock);

      graph.addEdge({
        source: note.id,
        target: codeBlock.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      const result = serializer.serialize();

      expect(result.markdown).toContain('# Test Note');
      expect(result.markdown).toContain('```javascript');
      expect(result.markdown).toContain('function hello() {');
      expect(result.markdown).toContain('  console.log("Hello!");');
      expect(result.markdown).toContain('}');
      expect(result.markdown).toContain('```');
    });

    it('should serialize code blocks without language', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const codeBlock = new CodeBlockNode(
        'test.md#code1',
        'Plain text code block',
        null
      );

      graph.addNode(note);
      graph.addNode(codeBlock);

      graph.addEdge({
        source: note.id,
        target: codeBlock.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      const result = serializer.serialize();

      expect(result.markdown).toContain('# Test Note');
      expect(result.markdown).toContain('```');
      expect(result.markdown).toContain('Plain text code block');
      expect(result.markdown).toContain('```');
    });
  });

  describe('Partial serialization', () => {
    it('should serialize from a specific root node', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const section1 = new SectionNode('test.md#section1', 'Section 1', 1);
      const section2 = new SectionNode('test.md#section2', 'Section 2', 2);
      const task1 = new TaskNode('test.md#task1', 'Task 1', TaskState.Open);

      graph.addNode(note);
      graph.addNode(section1);
      graph.addNode(section2);
      graph.addNode(task1);

      graph.addEdge({
        source: note.id,
        target: section1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: section1.id,
        target: section2.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: section2.id,
        target: task1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      // Serialize from section1
      const result = serializer.serialize({ rootId: section1.id });

      // Should include section1, section2, and task1, but not the note
      expect(result.markdown).toContain('# Section 1');
      expect(result.markdown).toContain('## Section 2');
      expect(result.markdown).toContain('- [ ] Task 1');
      expect(result.markdown).not.toContain('# Test Note');

      expect(result.serializedNodes).toContain(section1);
      expect(result.serializedNodes).toContain(section2);
      expect(result.serializedNodes).toContain(task1);
      expect(result.serializedNodes).not.toContain(note);
    });

    it('should serialize from a task node correctly', () => {
      const note = new NoteNode('test.md', 'Test Note');
      const task1 = new TaskNode('test.md#task1', 'Task 1', TaskState.Open, 0);
      const task1_1 = new TaskNode('test.md#task1_1', 'Subtask 1.1', TaskState.Open, 1);
      const task1_2 = new TaskNode('test.md#task1_2', 'Subtask 1.2', TaskState.Complete, 1);

      graph.addNode(note);
      graph.addNode(task1);
      graph.addNode(task1_1);
      graph.addNode(task1_2);

      graph.addEdge({
        source: note.id,
        target: task1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: task1.id,
        target: task1_1.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      graph.addEdge({
        source: task1.id,
        target: task1_2.id,
        relation: RelationType.ContainsChild,
        metadata: {}
      });

      // Serialize from task1
      const result = serializer.serialize({ rootId: task1.id });

      // Should include task1 and its subtasks, but not the note
      expect(result.markdown).toContain('- [ ] Task 1');
      expect(result.markdown).toContain('  - [ ] Subtask 1.1');
      expect(result.markdown).toContain('  - [x] Subtask 1.2');
      expect(result.markdown).not.toContain('# Test Note');

      expect(result.serializedNodes).toContain(task1);
      expect(result.serializedNodes).toContain(task1_1);
      expect(result.serializedNodes).toContain(task1_2);
      expect(result.serializedNodes).not.toContain(note);
    });
  });

  describe('Round-trip serialization', () => {
    it('should maintain the structure after parse-serialize round trip', () => {
      const markdown = `# Test Document

## Section 1

This is a paragraph in section 1.

- Bullet point 1
  - Nested bullet point
- [ ] Task 1
  - [x] Completed subtask
  - [ ] Open subtask

## Section 2

\`\`\`javascript
function hello() {
  console.log("Hello world!");
}
\`\`\`

- [ ] Another task`;

      // Parse the markdown to create a graph
      const parsedGraph = parser.parse(markdown, 'test.md');

      // Create a serializer with the parsed graph
      const graphSerializer = new MarkdownSerializer(parsedGraph);

      // Serialize back to markdown
      const result = graphSerializer.serialize();

      // The result should be effectively the same as the input
      // (might have slight formatting differences)
      expect(result.markdown).toContain('# Test Document');
      expect(result.markdown).toContain('## Section 1');
      expect(result.markdown).toContain('This is a paragraph in section 1.');
      expect(result.markdown).toContain('- Bullet point 1');
      expect(result.markdown).toContain('  - Nested bullet point');
      expect(result.markdown).toContain('- [ ] Task 1');
      expect(result.markdown).toContain('  - [x] Completed subtask');
      expect(result.markdown).toContain('  - [ ] Open subtask');
      expect(result.markdown).toContain('## Section 2');
      expect(result.markdown).toContain('```javascript');
      expect(result.markdown).toContain('function hello() {');
      expect(result.markdown).toContain('  console.log("Hello world!");');
      expect(result.markdown).toContain('```');
      expect(result.markdown).toContain('- [ ] Another task');

      // Parse the result markdown to verify the structure is preserved
      const roundTripGraph = parser.parse(result.markdown, 'test.md');

      // Compare node counts by type
      const originalTypeCounts = countNodesByType(parsedGraph);
      const roundTripTypeCounts = countNodesByType(roundTripGraph);

      expect(roundTripTypeCounts).toEqual(originalTypeCounts);

      expect(result.markdown).toEqual(markdown);
    });


    it('should contain the code block in the section, not list item', () => {
      const markdown = `# Test Document

- Bullet point 1

\`\`\`javascript
function hello() {
  console.log("Hello world!");
}
\`\`\`
`;

      // Parse the markdown to create a graph
      const parsedGraph = parser.parse(markdown, 'test.md');

      // Create a serializer with the parsed graph
      const graphSerializer = new MarkdownSerializer(parsedGraph);

      // Serialize back to markdown
      const result = graphSerializer.serialize();

      expect(result.markdown).toEqual(markdown);
    });


    it('should maintain the structure after parse-serialize round trip - simple project plan', () => {
      const markdown = `# Project Plan

- [x] Phase 1: Planning
  - [x] Define requirements
  - [x] Create timeline
  - [x] Assign resources
- [/] Phase 2: Implementation
  - [x] Set up development environment
  - [/] Develop core features
  - [ ] Complete testing
- [ ] Phase 3: Deployment
  - [ ] Prepare release notes
  - [ ] Deploy to staging
  - [ ] Final QA
  - [ ] Deploy to production`;

      // Parse, serialize, and verify exact match
      const parsedGraph = parser.parse(markdown, 'project-plan.md');
      const result = new MarkdownSerializer(parsedGraph).serialize();
      expect(result.markdown).toEqual(markdown);
    });

    it('should maintain the structure after parse-serialize round trip - deep nesting', () => {
      const markdown = `# Deep Nesting Test

- Level 1 Item
  - Level 2 Item
    - Level 3 Item
      - Level 4 Item
        - Level 5 Item
          - [ ] Level 6 Task
            - [x] Level 7 Completed Task
              - Level 8 Item
                - Level 9 Item
                  - Level 10 Item`;

      // Parse, serialize, and verify exact match
      const parsedGraph = parser.parse(markdown, 'nesting-test.md');
      const result = new MarkdownSerializer(parsedGraph).serialize();
      expect(result.markdown).toEqual(markdown);
    });

    it('should maintain the structure after parse-serialize round trip - complex task states', () => {
      const markdown = `# Task Status Test

- [ ] Open task
- [x] Completed task
- [/] In progress task
- [!] Blocked task
- [-] Cancelled task

## Nested with mixed states

- [ ] Parent task
  - [x] Completed subtask
  - [/] In progress subtask
  - [!] Blocked subtask
  - [-] Cancelled subtask

## Mixed content

- [ ] Task with code
  \`\`\`python
  def hello():
      print("Hello, world!")
  \`\`\`

- [x] Task with nested list
  - First item
  - Second item
    - Deeper item`;

      // Parse, serialize, and verify exact match
      const parsedGraph = parser.parse(markdown, 'task-states.md');
      const result = new MarkdownSerializer(parsedGraph).serialize();

      // strip completely empty lines from both sides
      const resultMarkdown = result.markdown.replace(/^\s*\n/gm, '');
      const markdownStripped = markdown.replace(/^\s*\n/gm, '');

      expect(resultMarkdown).toEqual(markdownStripped);
    });

    it('should maintain the structure after parse-serialize round trip - minimal content', () => {
      const markdown = `# Just a title`;

      // Parse, serialize, and verify exact match
      const parsedGraph = parser.parse(markdown, 'minimal.md');
      const result = new MarkdownSerializer(parsedGraph).serialize();
      expect(result.markdown).toEqual(markdown);
    });

    it('should maintain the structure after parse-serialize round trip - complex document', () => {
      const markdown = `# Research Notes on ML Architecture

## Introduction

This document outlines key concepts in modern ML architecture design.

## Transformer Architectures

Transformer models have revolutionized NLP and other domains:

- [x] Understand self-attention mechanism
  - [x] Query, Key, Value vectors
  - [x] Attention weights calculation
  - [x] Multi-head attention

- [/] Implement basic transformer
  - [x] Encoder component
  - [/] Decoder component
  - [ ] Full seq2seq model

\`\`\`python
import torch
import torch.nn as nn

class SelfAttention(nn.Module):
    def __init__(self, embed_size, heads):
        super(SelfAttention, self).__init__()
        self.embed_size = embed_size
        self.heads = heads
        self.head_dim = embed_size // heads
        
        assert (self.head_dim * heads == embed_size), "Embed size needs to be divisible by heads"
        
        self.values = nn.Linear(self.head_dim, self.head_dim, bias=False)
        self.keys = nn.Linear(self.head_dim, self.head_dim, bias=False)
        self.queries = nn.Linear(self.head_dim, self.head_dim, bias=False)
        self.fc_out = nn.Linear(heads * self.head_dim, embed_size)
\`\`\`

## Causal Inference in ML

- [ ] Study key causal inference concepts
  - [ ] Potential outcomes framework
  - [ ] Do-calculus
  - [ ] Confounding variables

- [ ] Implement causal models
  - [ ] Structural equation models
  - [ ] Causal effect estimation
  - [ ] Treatment effect models

## Next Steps

- Create benchmark experiments
- Review latest literature
- Schedule weekly progress meetings`;

      // Parse, serialize, and verify exact match
      const parsedGraph = parser.parse(markdown, 'ml-research.md');
      const result = new MarkdownSerializer(parsedGraph).serialize();

      // strip completely empty lines from both sides
      const resultMarkdown = result.markdown.replace(/^\s*\n/gm, '');
      const markdownStripped = markdown.replace(/^\s*\n/gm, '');

      expect(resultMarkdown).toEqual(markdownStripped);
    });
  });
});



/**
 * Helper function to count nodes by type in a graph
 */
function countNodesByType(graph: CannonballGraph): Record<NodeType, number> {
  const counts: Partial<Record<NodeType, number>> = {};

  const nodes = graph.getAllNodes();
  for (const node of nodes) {
    counts[node.type] = (counts[node.type] || 0) + 1;
  }

  return counts as Record<NodeType, number>;
}