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
  
  const person = graph.addNode(personData);
  const task = graph.addNode(taskData);
  
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
WHERE NOT EXISTS((p)-[:WORKS_ON]->(t))
CREATE (p)-[r:WORKS_ON {assigned: true, date: "2023-01-15"}]->(t)
\`\`\`
  `;
  
  // Execute the rule from markdown
  const results = engine.executeRulesFromMarkdown(graph, ruleMarkdown);
  
  console.log('\nRule execution results:');
  console.log(`Rule: ${results[0].rule.name}`);
  console.log(`Success: ${results[0].success}`);
  console.log(`Matches found: ${results[0].matchCount}`);
  
  // Check the updated graph
  console.log('\nGraph after rule execution:');
  console.log('Nodes:', graph.findNodes(() => true).length);
  console.log('Edges:', graph.findEdges(() => true).length);
  
  // Get the created relationship
  const relationship = graph.findEdges(edge => edge.label === 'WORKS_ON')[0];
  
  console.log('\nCreated relationship:');
  console.log(`From: ${graph.getNode(relationship.source)?.data.name}`);
  console.log(`To: ${graph.getNode(relationship.target)?.data.title}`);
  console.log('Properties:', relationship.data);
  
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
  
  // Check the updated task
  const updatedTask = graph.getNode(task.id);
  console.log('\nUpdated task:');
  console.log('Priority:', updatedTask?.data.priority); // Should now be "Critical"
}

// Export the example function
export default ruleEngineExample;