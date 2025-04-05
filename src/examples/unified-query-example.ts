/**
 * This example demonstrates the unified query API, showing how to use
 * the executeGraphQuery method to perform both read and write operations
 * in a single query.
 * 
 * The unified API provides a single entry point for all graph operations,
 * whether they are read-only (RETURN), write-only (CREATE/SET), or both.
 */

import { Graph } from '@/graph';
import { createRuleEngine, createQueryFormatter } from '@/rules';

/**
 * Set up a sample graph with some data
 */
function setupGraphData(): Graph {
  const graph = new Graph();
  
  // Add some person nodes
  graph.addNode('person1', { name: 'Alice', age: 30, labels: ['Person'] });
  graph.addNode('person2', { name: 'Bob', age: 35, labels: ['Person'] });
  graph.addNode('person3', { name: 'Charlie', age: 28, labels: ['Person'] });
  
  // Add some task nodes
  graph.addNode('task1', { title: 'Fix bug', priority: 'High', labels: ['Task'] });
  graph.addNode('task2', { title: 'Write docs', priority: 'Medium', labels: ['Task'] });
  
  // Add some relationships
  graph.addEdge('person1', 'task1', 'ASSIGNED_TO', { date: '2023-01-15' });
  graph.addEdge('person2', 'task2', 'ASSIGNED_TO', { date: '2023-01-20' });
  
  return graph;
}

/**
 * Log the current state of the graph
 */
function logGraphState(graph: Graph, label: string): void {
  console.log(`\n${label || 'Graph State'}:`);
  console.log(`Nodes: ${graph.getAllNodes().length}`);
  console.log(`Edges: ${graph.getAllEdges().length}`);
  
  const personNodes = graph.findNodes(n => n.data.labels?.includes('Person'));
  const taskNodes = graph.findNodes(n => n.data.labels?.includes('Task'));
  
  console.log(`Person nodes: ${personNodes.length}`);
  console.log(`Task nodes: ${taskNodes.length}`);
  
  console.log('People:');
  personNodes.forEach(person => {
    console.log(`  - ${person.data.name} (${person.data.age})`);
  });
  
  console.log('Tasks:');
  taskNodes.forEach(task => {
    console.log(`  - ${task.data.title} (${task.data.priority})`);
  });
  
  const edges = graph.getAllEdges();
  console.log('Relationships:');
  edges.forEach(edge => {
    const source = graph.getNodeById(edge.source);
    const target = graph.getNodeById(edge.target);
    console.log(`  - ${source?.data.name || edge.source} -[${edge.label}]-> ${target?.data.title || edge.target} (${edge.data.date || 'no date'})`);
  });
}

/**
 * Main example function
 */
function runUnifiedQueryExample(): void {
  console.log('Starting Unified Query API Example...\n');
  
  // Set up the graph and rule engine
  const graph = setupGraphData();
  const engine = createRuleEngine();
  const formatter = createQueryFormatter();
  
  logGraphState(graph, 'Initial Graph State');
  
  // Example 1: Read-only query (traditional query)
  console.log('\n=== Example 1: Read-only Query ===\n');
  
  const readQuery = 'MATCH (p:Person) RETURN p.name, p.age';
  console.log(`Executing query: ${readQuery}`);
  
  const readResult = engine.executeGraphQuery(graph, readQuery);
  
  console.log('\nQuery result stats:');
  console.log(`- Success: ${readResult.success}`);
  console.log(`- Matches: ${readResult.matchCount}`);
  console.log(`- Read operations: ${readResult.stats.readOperations}`);
  console.log(`- Write operations: ${readResult.stats.writeOperations}`);
  console.log(`- Execution time: ${readResult.stats.executionTimeMs}ms`);
  
  console.log('\nFormatted as markdown table:');
  console.log(formatter.toMarkdownTable(readResult));
  
  // Example 2: Write-only query
  console.log('\n=== Example 2: Write-only Query ===\n');
  
  const writeQuery = `
    MATCH (p:Person)
    WHERE p.name = 'Charlie'
    SET p.department = 'Engineering'
  `;
  console.log(`Executing query: ${writeQuery}`);
  
  const writeResult = engine.executeGraphQuery(graph, writeQuery);
  
  console.log('\nQuery result stats:');
  console.log(`- Success: ${writeResult.success}`);
  console.log(`- Matches: ${writeResult.matchCount}`);
  console.log(`- Read operations: ${writeResult.stats.readOperations}`);
  console.log(`- Write operations: ${writeResult.stats.writeOperations}`);
  console.log(`- Execution time: ${writeResult.stats.executionTimeMs}ms`);
  
  if (writeResult.actions) {
    console.log(`- Affected nodes: ${writeResult.actions.affectedNodes.length}`);
    console.log(`- Affected edges: ${writeResult.actions.affectedEdges.length}`);
  }
  
  logGraphState(graph, 'Graph State After Write-only Query');
  
  // Example 3: Combined read and write query
  console.log('\n=== Example 3: Combined Read and Write Query ===\n');
  
  const combinedQuery = `
    MATCH (p:Person)
    WHERE p.name = 'Bob'
    SET p.department = 'Marketing'
    RETURN p.name, p.age, p.department
  `;
  console.log(`Executing query: ${combinedQuery}`);
  
  const combinedResult = engine.executeGraphQuery(graph, combinedQuery);
  
  console.log('\nQuery result stats:');
  console.log(`- Success: ${combinedResult.success}`);
  console.log(`- Matches: ${combinedResult.matchCount}`);
  console.log(`- Read operations: ${combinedResult.stats.readOperations}`);
  console.log(`- Write operations: ${combinedResult.stats.writeOperations}`);
  console.log(`- Execution time: ${combinedResult.stats.executionTimeMs}ms`);
  
  if (combinedResult.actions) {
    console.log(`- Affected nodes: ${combinedResult.actions.affectedNodes.length}`);
    console.log(`- Affected edges: ${combinedResult.actions.affectedEdges.length}`);
  }
  
  if (combinedResult.query) {
    console.log('\nQuery results:');
    console.log(formatter.toMarkdownTable(combinedResult));
  }
  
  logGraphState(graph, 'Graph State After Combined Query');
  
  // Example 4: Creating new nodes and relationships
  console.log('\n=== Example 4: Creating New Nodes and Relationships ===\n');
  
  const createQuery = `
    MATCH (p:Person)
    WHERE p.name = 'Alice'
    CREATE (t:Task {title: 'Design UI', priority: 'High', labels: ['Task']})
    CREATE (p)-[r:ASSIGNED_TO {date: '2023-02-01'}]->(t)
    RETURN p.name, t.title
  `;
  console.log(`Executing query: ${createQuery}`);
  
  const createResult = engine.executeGraphQuery(graph, createQuery);
  
  console.log('\nQuery result stats:');
  console.log(`- Success: ${createResult.success}`);
  console.log(`- Matches: ${createResult.matchCount}`);
  console.log(`- Read operations: ${createResult.stats.readOperations}`);
  console.log(`- Write operations: ${createResult.stats.writeOperations}`);
  console.log(`- Execution time: ${createResult.stats.executionTimeMs}ms`);
  
  if (createResult.actions) {
    console.log(`- Affected nodes: ${createResult.actions.affectedNodes.length}`);
    console.log(`- Affected edges: ${createResult.actions.affectedEdges.length}`);
  }
  
  if (createResult.query) {
    console.log('\nQuery results:');
    console.log(formatter.toMarkdownTable(createResult));
  }
  
  logGraphState(graph, 'Final Graph State');
  
  console.log('\nUnified Query API Example Completed!');
}

// Run the example if this file is executed directly
if (require.main === module) {
  runUnifiedQueryExample();
}

export { runUnifiedQueryExample };