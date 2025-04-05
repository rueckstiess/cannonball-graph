import { Graph } from '@/graph';
import { createRuleEngine } from '@/rules';

/**
 * Example of using the rule engine
 */
function ruleEngineExample() {
  // Initialize graph
  const graph = new Graph();

  // Create some initial nodes
  const personData = { name: 'John', age: 35, labels: ['Person'] };
  const taskData = { title: 'Fix bugs', priority: 'High', labels: ['Task'] };

  // Generate unique IDs for our nodes
  const personId = `person-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Add nodes with proper IDs
  graph.addNode(personId, personData);
  graph.addNode(taskId, taskData);

  console.log('Initial graph:');
  console.log('Nodes:', graph.findNodes(() => true).length);
  console.log('Edges:', graph.findEdges(() => true).length);

  // Create a rule engine
  const engine = createRuleEngine();

  // Define a rule in markdown
  const ruleMarkdown = `
## Connect People to Tasks

\`\`\`graphrule
name: ConnectPersonToTask
description: Create WORKS_ON relationships between people and tasks if missing
priority: 10

MATCH (p:Person), (t:Task)
CREATE (p)-[r:WORKS_ON {assigned: true, date: "2023-01-15"}]->(t)
\`\`\`
  `;

  // Debug the pattern matching
  console.log('\nPerson nodes:', graph.findNodes(node => node.data.labels?.includes('Person')).map(n => n.id));
  console.log('Task nodes:', graph.findNodes(node => node.data.labels?.includes('Task')).map(n => n.id));

  // Execute the rule from markdown
  const results = engine.executeRulesFromMarkdown(graph, ruleMarkdown);

  console.log('\nRule execution results:');
  console.log(`Rule: ${results[0].rule.name}`);
  console.log(`Success: ${results[0].success}`);
  console.log(`Matches found: ${results[0].matchCount}`);
  if (!results[0].success && results[0].error) {
    console.log(`Error: ${results[0].error}`);
  }

  // Debug the results in more detail
  console.log('Full results:', JSON.stringify(results[0], null, 2));

  // Check the updated graph
  console.log('\nGraph after rule execution:');
  console.log('Nodes:', graph.findNodes(() => true).length);
  console.log('Edges:', graph.findEdges(() => true).length);

  // Define and execute another rule to modify properties
  const modifyRuleMarkdown = `
## Update Task Priority

\`\`\`graphrule
name: UpdateTaskPriority
description: Set task priority to Critical for all tasks with WORKS_ON relationships
priority: 5

MATCH (p:Person)-[r:WORKS_ON]->(t:Task)
WHERE r.assigned = true
SET t.priority = "Critical"
\`\`\`
  `;

  // Execute the second rule
  const modifyResults = engine.executeRulesFromMarkdown(graph, modifyRuleMarkdown);

  console.log('\nSecond rule execution results:');
  console.log(`Rule: ${modifyResults[0].rule.name}`);
  console.log(`Success: ${modifyResults[0].success}`);
  console.log(`Matches found: ${modifyResults[0].matchCount}`);

  // Check the updated task - find by title since task should still be the only one
  const updatedTask = graph.findNodes(node => node.data.title === 'Fix bugs')[0];
  console.log('\nUpdated task:');
  console.log('Priority:', updatedTask?.data.priority); // Should now be "Critical"
}

// Export the example function
export default ruleEngineExample;

// Execute the example when run directly
if (import.meta.url === import.meta.resolve('./rule-engine-example.ts')) {
  console.log('Running rule engine example...');
  ruleEngineExample();
}