// examples/markdown-to-graph.ts
import { MarkdownParser, MarkdownSerializer, CannonballGraph } from '../src';

/**
 * Example demonstrating the process of:
 * 1. Parsing Markdown into a Cannonball graph
 * 2. Making modifications to the graph
 * 3. Serializing back to Markdown
 */
async function markdownToGraphExample() {
  // Sample markdown content
  const markdown = `# Project Plan

## Research
- [ ] Market Analysis
  - [ ] Competitor research
  - [ ] Customer segmentation
- [ ] Technical Feasibility
  - [x] Platform evaluation
  - [ ] Technology stack selection

## Development
- [ ] Phase 1: Foundation
  - [ ] Architecture design
  - [ ] Core components
- [ ] Phase 2: Features
  - Technical tasks
    - [ ] API integration
    - [ ] Data modeling
  - User-facing
    - [ ] UI design
    - [ ] User testing

## Deployment
- [ ] Release planning
- [ ] Infrastructure setup

## Notes
Some miscellaneous notes about the project.

\`\`\`javascript
// Example code
function initialize() {
  console.log("Project initialized");
}
\`\`\`
`;

  // Step 1: Parse the markdown into a graph
  const parser = new MarkdownParser();
  const graph = parser.parse(markdown, 'project-plan.md');

  // Log some statistics
  console.log(`Parsed graph contains:`);
  console.log(`- ${graph.getAllNodes().length} nodes`);
  console.log(`- ${graph.getAllEdges().length} edges`);

  // Print node types
  const nodeTypeCount: Record<string, number> = {};
  graph.getAllNodes().forEach(node => {
    nodeTypeCount[node.type] = (nodeTypeCount[node.type] || 0) + 1;
  });
  console.log('Node types:');
  Object.entries(nodeTypeCount).forEach(([type, count]) => {
    console.log(`- ${type}: ${count}`);
  });

  // Step 2: Analyze the graph

  // Find all tasks
  const tasks = graph.findNodesByType('task');
  console.log(`\nFound ${tasks.length} tasks in the document`);

  // Count completed vs. open tasks
  const completedTasks = tasks.filter(t => t.metadata.taskState === 'complete');
  console.log(`- ${completedTasks.length} completed tasks`);
  console.log(`- ${tasks.length - completedTasks.length} open tasks`);

  // Find tasks that block the most other tasks
  const blockingTasks = tasks.map(task => {
    const blockingCount = graph.getRelatingNodes(task.id, 'depends_on').length;
    return { task, blockingCount };
  }).sort((a, b) => b.blockingCount - a.blockingCount);

  console.log('\nTop blocking tasks:');
  blockingTasks.slice(0, 3).forEach(({ task, blockingCount }) => {
    if (blockingCount > 0) {
      console.log(`- "${task.content}" blocks ${blockingCount} task(s)`);
    }
  });

  // Step 3: Make some modifications to the graph

  // Mark a task as in-progress
  const taskToUpdate = tasks.find(t => t.content === 'Architecture design');
  if (taskToUpdate) {
    const updatedTask = {
      ...taskToUpdate,
      metadata: {
        ...taskToUpdate.metadata,
        taskState: 'in_progress'
      }
    };
    graph.updateNode(updatedTask);
    console.log('\nUpdated "Architecture design" task to in-progress');
  }

  // Add a new task
  const developmentSection = graph.getAllNodes().find(
    n => n.type === 'heading' && n.content === 'Development'
  );

  if (developmentSection) {
    const phase1 = graph.getAllNodes().find(
      n => n.content === 'Phase 1: Foundation'
    );

    if (phase1) {
      // Create a new task node
      const newTask = {
        id: `project-plan.md#task-new`,
        type: 'task',
        content: 'Documentation setup',
        metadata: {
          taskState: 'open',
          position: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          filePath: 'project-plan.md'
        },
        createdDate: new Date(),
        modifiedDate: new Date(),
      };

      graph.addNode(newTask);

      // Add relationships
      graph.addEdge({
        source: phase1.id,
        target: newTask.id,
        relation: 'contains',
        metadata: {}
      });

      graph.addEdge({
        source: phase1.id,
        target: newTask.id,
        relation: 'depends_on',
        metadata: {}
      });

      console.log('\nAdded new task "Documentation setup" to Phase 1');
    }
  }

  // Step 4: Serialize back to markdown
  const serializer = new MarkdownSerializer();
  const result = serializer.serialize(graph, { includeMetadata: true });

  console.log('\nSerialized graph back to markdown:');
  console.log(`Generated ${result.files.size} file(s)`);

  // Output the updated markdown
  console.log('\n==== BEGIN UPDATED MARKDOWN ====');
  console.log(result.files.get('project-plan.md'));
  console.log('==== END UPDATED MARKDOWN ====');
}

// Run the example
markdownToGraphExample().catch(console.error);