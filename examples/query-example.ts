import { Graph } from '@/graph';
import { createQueryEngine, createQueryFormatter, createQueryUtils } from '@/query';

console.log('=======================================');
console.log('Cannonball Query Functionality Example');
console.log('=======================================\n');

// Initialize graph, query engine, and query utilities
const graph = new Graph();
const engine = createQueryEngine();
const formatter = createQueryFormatter();
const utils = createQueryUtils();

// Create initial data structure
console.log('1. Setting up initial graph data...');
setupGraphData();
logGraphState();

// -------------------------------------------------------------------------
// Basic query example
// -------------------------------------------------------------------------
console.log('\n2. Basic query: Find all Person nodes');
const basicQuery = 'MATCH (p:Person) RETURN p';

const basicResult = engine.executeQuery(graph, basicQuery);

console.log(`Query: ${basicQuery}`);
console.log(`Success: ${basicResult.success}`);
console.log(`Matches found: ${basicResult.matchCount}`);
console.log('Results:');
console.log(formatter.toTextTable(basicResult));

// -------------------------------------------------------------------------
// Query with property access
// -------------------------------------------------------------------------
console.log('\n3. Property access: Get person names and ages');
const propertyQuery = 'MATCH (p:Person) RETURN p.name, p.age';

const propertyResult = engine.executeQuery(graph, propertyQuery);

console.log(`Query: ${propertyQuery}`);
console.log(`Success: ${propertyResult.success}`);
console.log(`Matches found: ${propertyResult.matchCount}`);
console.log('Results:');
console.log(formatter.toTextTable(propertyResult));

// Extract a specific column using the utils
const names = utils.extractColumn(propertyResult, 'p.name');
console.log('\nExtracted names:', names);

// Convert results to an array of objects
const peopleObjects = utils.toObjectArray(propertyResult);
console.log('\nResults as objects:');
console.log(peopleObjects);

// -------------------------------------------------------------------------
// Query with WHERE conditions
// -------------------------------------------------------------------------
console.log('\n4. Using WHERE conditions: Find people over 30');
const whereQuery = 'MATCH (p:Person) WHERE p.age > 30 RETURN p.name, p.age, p.department';

const whereResult = engine.executeQuery(graph, whereQuery);

console.log(`Query: ${whereQuery}`);
console.log(`Success: ${whereResult.success}`);
console.log(`Matches found: ${whereResult.matchCount}`);
console.log('Results as markdown table:');
console.log(formatter.toMarkdownTable(whereResult));

// -------------------------------------------------------------------------
// Query with relationship patterns
// -------------------------------------------------------------------------
console.log('\n5. Relationship patterns: Find task assignments');
const relationshipQuery = 'MATCH (p:Person)-[r:ASSIGNED_TO]->(t:Task) RETURN p.name, t.title, r.date';

const relationshipResult = engine.executeQuery(graph, relationshipQuery);

console.log(`Query: ${relationshipQuery}`);
console.log(`Success: ${relationshipResult.success}`);
console.log(`Matches found: ${relationshipResult.matchCount}`);
console.log('Results:');
console.log(formatter.toTextTable(relationshipResult));

// -------------------------------------------------------------------------
// Complex query with multiple patterns
// -------------------------------------------------------------------------
console.log('\n6. Complex query: Find all managers and their tasks');
const complexQuery = `
  MATCH (p:Person)-[:MANAGES]->(proj:Project), (t:Task)-[:PART_OF]->(proj)
  RETURN p.name, proj.name, t.title
`;

const complexResult = engine.executeQuery(graph, complexQuery.trim());

console.log(`Query: ${complexQuery.trim()}`);
console.log(`Success: ${complexResult.success}`);
console.log(`Matches found: ${complexResult.matchCount}`);
console.log('Results:');
console.log(formatter.toTextTable(complexResult));

// -------------------------------------------------------------------------
// JSON output
// -------------------------------------------------------------------------
console.log('\n8. JSON output: Format results as JSON');
const jsonQuery = 'MATCH (p:Person)-[:ASSIGNED_TO]->(t:Task) RETURN p, t';

const jsonResult = engine.executeQuery(graph, jsonQuery);

console.log(`Query: ${jsonQuery}`);
console.log(`Success: ${jsonResult.success}`);
console.log(`Matches found: ${jsonResult.matchCount}`);
console.log('Results as JSON:');
console.log(formatter.toJSON(jsonResult, { prettyPrint: true }));

// -------------------------------------------------------------------------
// Subgraph creation
// -------------------------------------------------------------------------
console.log('\n9. Subgraph creation: Create a subgraph from query results');
const subgraphQuery = 'MATCH (p:Person)-[r:ASSIGNED_TO]->(t:Task) RETURN p, r, t';

const subgraphResult = engine.executeQuery(graph, subgraphQuery);
const subgraph = utils.toSubgraph(subgraphResult);

console.log(`Query: ${subgraphQuery}`);
console.log(`Original graph: ${graph.getAllNodes().length} nodes, ${graph.getAllEdges().length} edges`);
console.log(`Subgraph: ${subgraph.getAllNodes().length} nodes, ${subgraph.getAllEdges().length} edges`);

// Summary
console.log('\n=======================================');
console.log('Query Functionality Example Complete');
console.log('=======================================\n');

/**
 * Setup initial graph data with a variety of nodes and relationships
 */
function setupGraphData(): void {
  // Create people
  graph.addNode('person1', 'Person', { name: 'Alice', age: 35, department: 'Engineering', }); graph.addNode('person2', 'Person', { name: 'Bob', age: 28, department: 'Engineering', }); graph.addNode('person3', 'Person', { name: 'Charlie', age: 42, department: 'Marketing', }); graph.addNode('person4', 'Person', { name: 'Diana', age: 31, department: 'Product', });
  // Create tasks
  graph.addNode('task1', 'Task', {
    title: 'Fix API bug',
    priority: 'High',
    status: 'In Progress',
    department: 'Engineering',
    dueDate: '2023-01-20',
  });

  graph.addNode('task2', 'Task', {
    title: 'Create marketing materials',
    priority: 'Medium',
    status: 'Not Started',
    department: 'Marketing',
    dueDate: '2023-02-10',
  });

  graph.addNode('task3', 'Task', {
    title: 'Review product specs',
    priority: 'High',
    status: 'In Progress',
    department: 'Product',
    dueDate: '2023-01-15',
  });

  graph.addNode('task4', 'Task', {
    title: 'Deploy new feature',
    priority: 'High',
    status: 'Ready For Review',
    department: 'Engineering',
    dueDate: '2023-01-25',
  });

  // Create projects
  graph.addNode('project1', 'Project', {
    name: 'Mobile App',
    status: 'In Progress',
    dueDate: '2023-03-01',
  });

  graph.addNode('project2', 'Project', {
    name: 'Website Redesign',
    status: 'Planning',
    dueDate: '2023-04-15',
  });

  // Add relationships
  // Task assignments
  graph.addEdge('person1', 'task1', 'ASSIGNED_TO', { date: '2023-01-05' });
  graph.addEdge('person2', 'task4', 'ASSIGNED_TO', { date: '2023-01-10' });
  graph.addEdge('person3', 'task2', 'ASSIGNED_TO', { date: '2023-01-12' });
  graph.addEdge('person4', 'task3', 'ASSIGNED_TO', { date: '2023-01-08' });

  // Project management
  graph.addEdge('person1', 'project1', 'MANAGES', { since: '2022-12-01' });
  graph.addEdge('person3', 'project2', 'MANAGES', { since: '2022-11-15' });

  // Tasks as part of projects
  graph.addEdge('task1', 'project1', 'PART_OF', { added: '2022-12-05' });
  graph.addEdge('task4', 'project1', 'PART_OF', { added: '2022-12-10' });
  graph.addEdge('task2', 'project2', 'PART_OF', { added: '2022-11-20' });
  graph.addEdge('task3', 'project2', 'PART_OF', { added: '2022-12-01' });

  // Task dependencies
  graph.addEdge('task4', 'task1', 'DEPENDS_ON', { critical: true });
  graph.addEdge('task3', 'task2', 'DEPENDS_ON', { critical: false });
}

/**
 * Log the current state of the graph with node and edge counts
 */
function logGraphState(): void {
  console.log(`Graph state: ${graph.getAllNodes().length} nodes, ${graph.getAllEdges().length} edges`);

  // Count by label/type
  const personCount = graph.findNodes(n => n.data.labels?.includes('Person')).length;
  const taskCount = graph.findNodes(n => n.data.labels?.includes('Task')).length;
  const projectCount = graph.findNodes(n => n.data.labels?.includes('Project')).length;

  console.log(`Person nodes: ${personCount}`);
  console.log(`Task nodes: ${taskCount}`);
  console.log(`Project nodes: ${projectCount}`);

  // Count some relationship types
  const assignedCount = graph.findEdges(e => e.label === 'ASSIGNED_TO').length;
  const managesCount = graph.findEdges(e => e.label === 'MANAGES').length;
  const partOfCount = graph.findEdges(e => e.label === 'PART_OF').length;

  console.log(`ASSIGNED_TO relationships: ${assignedCount}`);
  console.log(`MANAGES relationships: ${managesCount}`);
  console.log(`PART_OF relationships: ${partOfCount}`);
}



// Create users, products and initial purchase relationships
engine.executeQuery(graph, `
  CREATE (:User {id: "u1", name: "Alice", interests: "tech, books"}),
         (:User {id: "u2", name: "Bob", interests: "sports, tech}),
         (:User {id: "u3", name: "Charlie", interests: "books, cooking}),
         (:Product {id: "p1", name: "Smartphone", category: "tech"}),
         (:Product {id: "p2", name: "Headphones", category: "tech"}),
         (:Product {id: "p3", name: "Cookbook", category: "books"})
`);

// Create initial purchase relationships
engine.executeQuery(graph, `
  MATCH (u:User {id: "u1"}), (p:Product {id: "p1"}) 
  CREATE (u)-[:PURCHASED {date: "2023-05-10"}]->(p)
`);
engine.executeQuery(graph, `
  MATCH (u:User {id: "u2"}), (p:Product {id: "p2"}) 
  CREATE (u)-[:PURCHASED {date: "2023-06-15"}]->(p)
`);

// Complex query that:
// 1. Finds users interested in tech who haven't purchased the Smartphone yet
// 2. Creates a RECOMMENDED relationship between those users and the Smartphone
// 3. Sets a relevance score based on whether they purchased other tech products

const result = engine.executeQuery(graph, `
  MATCH (target:Product {id: "p1"}),
        (u:User)
  WHERE "tech" IN u.interests
    AND NOT EXISTS((u)-[:PURCHASED]->(target))
  MATCH (u)-[p:PURCHASED]->(otherProd:Product)
  WHERE otherProd.category = target.category
  CREATE (u)-[r:RECOMMENDED]->(target)
  SET r.score = 0.8, r.createdAt = "2023-08-15"
  RETURN u.name, target.name, r.score
`);

console.log(result);

console.log(formatter.toTextTable(result));
/* Output:
u.name    | target.name  | r.score | r.reason
----------+-------------+---------+-------------------------
"Bob"     | "Smartphone" | 0.8     | "Based on your interest in tech"
*/