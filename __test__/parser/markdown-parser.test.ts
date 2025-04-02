// __test__/parser/markdown-parser.test.ts
import { MarkdownParser } from '@/parser/markdown-parser';
import { NodeType, RelationType, TaskState } from '@/core/types';

describe('MarkdownParser', () => {
  let parser: MarkdownParser;

  beforeEach(() => {
    parser = new MarkdownParser();
  });

  describe('Basic parsing', () => {
    it('should parse a simple markdown file with headings', () => {
      const markdown = `# Heading 1
Some text

## Heading 2
More text
`;
      const graph = parser.parse(markdown, 'test.md');

      // Check nodes
      const nodes = graph.getAllNodes();
      expect(nodes.length).toBe(5); // note, 2 headings, 2 paragraphs

      // Verify headings
      const headings = nodes.filter(n => n.type === NodeType.Section);
      expect(headings.length).toBe(2);
      expect(headings[0].content).toBe('Heading 1');
      expect(headings[1].content).toBe('Heading 2');

      // Verify heading level
      expect(headings[0].metadata.level).toBe(1);
      expect(headings[1].metadata.level).toBe(2);

      // Check relationships
      const h1 = headings.find(h => h.content === 'Heading 1')!;
      const h2 = headings.find(h => h.content === 'Heading 2')!;

      // H2 should be contained by H1
      const children = graph.getRelatedNodes(h1.id, RelationType.ContainsChild);
      expect(children.some(n => n.id === h2.id)).toBe(true);
    });

    it('should parse task lists with nested structure', () => {
      const markdown = `# Tasks
- [ ] Task 1
  - [ ] Subtask 1.1
  - [x] Subtask 1.2
- [/] Task 2
  - [ ] Subtask 2.1
`;
      const graph = parser.parse(markdown, 'tasks.md');

      // Get tasks
      const tasks = graph.getAllNodes().filter(n => n.type === NodeType.Task);
      expect(tasks.length).toBe(5);

      // Verify task states
      const task1 = tasks.find(t => t.content === 'Task 1')!;
      const subtask12 = tasks.find(t => t.content === 'Subtask 1.2')!;
      const task2 = tasks.find(t => t.content === 'Task 2')!;

      expect(task1.metadata.taskState).toBe(TaskState.Open);
      expect(subtask12.metadata.taskState).toBe(TaskState.Complete);
      expect(task2.metadata.taskState).toBe(TaskState.InProgress);

      // Check relationships
      // Task 1 should contain its subtasks
      const task1Children = graph.getRelatedNodes(task1.id, RelationType.ContainsChild);
      expect(task1Children.length).toBe(2);

      // Task 1 should depend on its subtasks
      const task1Dependencies = graph.getRelatedNodes(task1.id, RelationType.DependsOn);
      expect(task1Dependencies.length).toBe(2);
    });

    it('should parse code blocks', () => {
      const markdown = `# Code Example

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`
`;
      const graph = parser.parse(markdown, 'code.md');

      // Find code node
      const codeNodes = graph.getAllNodes().filter(n =>
        n.metadata.language === 'javascript'
      );

      expect(codeNodes.length).toBe(1);
      expect(codeNodes[0].content).toContain('function hello()');
      expect(codeNodes[0].metadata.language).toBe('javascript');
    });

    it('should parse mixed content with complex nesting', () => {
      const markdown = `# Project Plan

## Phase 1
- [ ] Research
  - [x] Competitor analysis
  - [ ] Market research
- [ ] Planning
  - Requirements gathering
  - [ ] Schedule creation

## Phase 2
- [/] Implementation
`;
      const graph = parser.parse(markdown, 'project.md');

      // Verify structure
      const allNodes = graph.getAllNodes();
      const phase1 = allNodes.find(n => n.type === NodeType.Section && n.content === 'Phase 1')!;
      const phase2 = allNodes.find(n => n.type === NodeType.Section && n.content === 'Phase 2')!;
      const research = allNodes.find(n => n.type === NodeType.Task && n.content === 'Research')!;
      const implementation = allNodes.find(n => n.type === NodeType.Task && n.content === 'Implementation')!;

      // Check heading relationships
      const rootHeading = allNodes.find(n => n.content === 'Project Plan' && n.type === NodeType.Section)!;
      expect(graph.getRelatedNodes(rootHeading.id, RelationType.ContainsChild)).toContainEqual(
        expect.objectContaining({ id: phase1.id })
      );
      expect(graph.getRelatedNodes(rootHeading.id, RelationType.ContainsChild)).toContainEqual(
        expect.objectContaining({ id: phase2.id })
      );

      // Check task relationships
      expect(graph.getRelatedNodes(phase1.id, RelationType.ContainsChild)).toContainEqual(
        expect.objectContaining({ id: research.id })
      );
      expect(graph.getRelatedNodes(phase2.id, RelationType.ContainsChild)).toContainEqual(
        expect.objectContaining({ id: implementation.id })
      );

      // Verify task dependencies
      const competitorAnalysis = allNodes.find(
        n => n.type === NodeType.Task && n.content === 'Competitor analysis'
      )!;
      const marketResearch = allNodes.find(
        n => n.type === NodeType.Task && n.content === 'Market research'
      )!;

      expect(graph.getRelatedNodes(research.id, RelationType.DependsOn)).toContainEqual(
        expect.objectContaining({ id: competitorAnalysis.id })
      );
      expect(graph.getRelatedNodes(research.id, RelationType.DependsOn)).toContainEqual(
        expect.objectContaining({ id: marketResearch.id })
      );
    });
  });

  describe('Complex scenarios', () => {
    it('should handle categories in task lists', () => {
      const markdown = `# Tasks
- [ ] Main Task
  - Category 1
    - [ ] Subtask 1.1
    - [ ] Subtask 1.2
  - Category 2
    - [ ] Subtask 2.1
`;
      const graph = parser.parse(markdown, 'categories.md');

      // Find nodes
      const mainTask = graph.getAllNodes().find(n => n.content === 'Main Task')!;
      const category1 = graph.getAllNodes().find(n => n.content === 'Category 1')!;
      const subtask11 = graph.getAllNodes().find(n => n.content === 'Subtask 1.1')!;
      const subtask21 = graph.getAllNodes().find(n => n.content === 'Subtask 2.1')!;

      // Verify structure
      expect(graph.getRelatedNodes(mainTask.id, RelationType.ContainsChild)).toContainEqual(
        expect.objectContaining({ id: category1.id })
      );

      expect(graph.getRelatedNodes(category1.id, RelationType.ContainsChild)).toContainEqual(
        expect.objectContaining({ id: subtask11.id })
      );

      // Main task should depend on all subtasks
      const dependencies = graph.getRelatedNodes(mainTask.id, RelationType.DependsOn);
      expect(dependencies).toContainEqual(expect.objectContaining({ id: subtask11.id }));
      expect(dependencies).toContainEqual(expect.objectContaining({ id: subtask21.id }));
    });

    it('should maintain task dependencies across nested structures', () => {
      const markdown = `# Project
- [ ] Phase 1
  - [ ] Step 1
    - [ ] Subtask A
    - [ ] Subtask B
  - [ ] Step 2
- [ ] Phase 2
  - [ ] Step 3
    - [ ] Subtask C
`;
      const graph = parser.parse(markdown, 'nested.md');

      // Find key tasks
      const phase1 = graph.searchNodes('Phase 1')[0];
      const phase2 = graph.searchNodes('Phase 2')[0];
      const step1 = graph.searchNodes('Step 1')[0];
      const subtaskA = graph.searchNodes('Subtask A')[0];

      // Phase 1 should depend on Step 1 and Step 2, but not on Sutbtask A or Phase 2
      const phase1Dependencies = graph.getRelatedNodes(phase1.id, RelationType.DependsOn);
      expect(phase1Dependencies).toContainEqual(expect.objectContaining({ id: step1.id }));
      expect(phase1Dependencies).not.toContainEqual(expect.objectContaining({ id: subtaskA.id }));
      expect(phase1Dependencies).not.toContainEqual(expect.objectContaining({ id: phase2.id }));

      // Step 1 should depend on Subtask A and Subtask B
      const step1Dependencies = graph.getRelatedNodes(step1.id, RelationType.DependsOn);
      expect(step1Dependencies).toContainEqual(expect.objectContaining({ id: subtaskA.id }));


      // Verify the dependency chain is correct (transitive dependencies not created by default)
      const project = graph.getAllNodes().find(
        n => n.type === NodeType.Section && n.content === 'Project'
      )!;
      const projectDependencies = graph.getRelatedNodes(project.id, RelationType.DependsOn);
      expect(projectDependencies.length).toBe(0); // Headings don't have dependencies
    });
  });
});