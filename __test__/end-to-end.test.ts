import { Graph } from '@/graph';
import { createRuleEngine, RuleEngine } from '@/rules'


describe('Path Pattern Matching', () => {

  let graph: Graph<any, any>;
  let engine: RuleEngine;

  beforeEach(() => {
    // Create a new graph for each test
    graph = new Graph<any, any>();
    engine = createRuleEngine();

    // Add nodes with different types and properties

    // People
    graph.addNode('alice', { type: 'person', name: 'Alice', age: 30, active: true });
    graph.addNode('bob', { type: 'person', name: 'Bob', age: 40, active: true });
    graph.addNode('charlie', { type: 'person', name: 'Charlie', age: 25, active: false });
    graph.addNode('dave', { type: 'person', name: 'Dave', age: 35, active: true });
    graph.addNode('eve', { type: 'person', name: 'Eve', age: 28, active: true });

    // Organizations
    graph.addNode('techCorp', { type: 'company', name: 'TechCorp', active: true });
    graph.addNode('eduInst', { type: 'university', name: 'EduInst' });

    // Tasks
    graph.addNode('task1', { type: 'task', name: 'Fix bug', active: true });
    graph.addNode('task2', { type: 'task', name: 'Write docs', active: false });
    graph.addNode('task3', { type: 'task', name: 'Deploy app', active: true });

    // Categories
    graph.addNode('cat1', { type: 'category', name: 'Work', tags: ['important', 'professional'] });
    graph.addNode('cat2', { type: 'category', name: 'Personal', tags: ['leisure', 'health'] });

    // Create a social network with KNOWS relationships (for path testing)
    // Alice knows Bob, Charlie, and Eve
    graph.addEdge('alice', 'bob', 'KNOWS', { since: '2020-01-01', weight: 5 });
    graph.addEdge('alice', 'charlie', 'KNOWS', { since: '2021-02-15', weight: 3 });
    graph.addEdge('alice', 'eve', 'KNOWS', { since: '2019-06-10', weight: 4 });

    // Bob knows Charlie and Dave
    graph.addEdge('bob', 'charlie', 'KNOWS', { since: '2018-12-05', weight: 2 });
    graph.addEdge('bob', 'dave', 'KNOWS', { since: '2022-03-20', weight: 3 });

    // Charlie knows Eve
    graph.addEdge('charlie', 'eve', 'KNOWS', { since: '2020-07-18', weight: 4 });

    // Dave knows Eve
    graph.addEdge('dave', 'eve', 'KNOWS', { since: '2021-11-03', weight: 1 });

    // Eve knows Alice
    graph.addEdge('eve', 'alice', 'KNOWS', { since: '2022-01-25', weight: 5 });

    // Additional relationship types for testing
    // WORKS_AT relationships
    graph.addEdge('alice', 'techCorp', 'WORKS_AT', { since: '2018-05-01', role: 'Engineer' });
    graph.addEdge('bob', 'techCorp', 'WORKS_AT', { since: '2019-10-15', role: 'Manager' });
    graph.addEdge('charlie', 'eduInst', 'STUDIES_AT', { since: '2020-09-01', program: 'Computer Science' });

    // ASSIGNED relationships
    graph.addEdge('alice', 'task1', 'ASSIGNED', { since: '2023-01-01' });
    graph.addEdge('bob', 'task2', 'ASSIGNED', { since: '2023-02-15' });
    graph.addEdge('charlie', 'task3', 'ASSIGNED', { since: '2023-03-10' });

    // BELONGS_TO relationships
    graph.addEdge('task1', 'cat1', 'BELONGS_TO', { primary: true });
    graph.addEdge('task2', 'cat1', 'BELONGS_TO', { primary: true });
    graph.addEdge('task3', 'cat2', 'BELONGS_TO', { primary: true });
  });

  describe('Simple MATCH rules', () => {

    test('Matching one node type', () => {

      const ruleMarkdown = `
    \`\`\`graphrule
    name: Match Persons
    description: Find all persons in the graph
    priority: 10
    
    MATCH (p:Person)
    RETURN p
    \`\`\`
        `;

      // Execute the query
      const results = engine.executeQueriesFromMarkdown(graph, ruleMarkdown);

      // Log results for debugging
      console.log('\nRule execution results for pattern matching binding test:');
      console.log(`Results: ${JSON.stringify(results, null, 2)}`);

    });
  });
});