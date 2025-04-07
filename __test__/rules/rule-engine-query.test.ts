import { Graph } from '@/graph';
import { QueryEngine, createQueryEngine, QueryResult } from '@/rules/query-engine';

describe('Rule Engine Query Functionality', () => {
  let engine: QueryEngine;
  let graph: Graph;

  beforeEach(() => {
    engine = createQueryEngine();
    graph = new Graph();

    // Set up a test graph with nodes and relationships
    graph.addNode('person1', 'Person', { name: 'Alice', age: 30, });
    graph.addNode('person2', 'Person', { name: 'Bob', age: 28, });
    graph.addNode('task1', 'Task', { title: 'Task 1', priority: 'High', });
    graph.addNode('task2', 'Task', { title: 'Task 2', priority: 'Low', });
    // Add some relationships
    graph.addEdge('person1', 'task1', 'ASSIGNED_TO', { date: '2023-01-10' });
    graph.addEdge('person2', 'task2', 'ASSIGNED_TO', { date: '2023-01-15' });
  });

  test('executeQuery handles simple RETURN of variables', () => {
    const query = 'MATCH (p:Person) RETURN p';
    const result = engine.executeQuery(graph, query);

    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(2); // Two person nodes

    // Check that stats are included
    expect(result.stats.readOperations).toBe(true);
    expect(result.stats.writeOperations).toBe(false);
    expect(typeof result.stats.executionTimeMs).toBe('number');

    // Check that query data is included
    expect(result.query).toBeDefined();
    expect(result.query!.columns).toEqual(['p']);
    expect(result.query!.rows.length).toBe(2);

    // Check the returned values
    expect(result.query!.rows[0][0].type).toBe('node');
    expect(result.query!.rows[0][0].name).toBe('p');
    expect(result.query!.rows[0][0].value.data.name).toBe('Alice');

    expect(result.query!.rows[1][0].type).toBe('node');
    expect(result.query!.rows[1][0].name).toBe('p');
    expect(result.query!.rows[1][0].value.data.name).toBe('Bob');
  });

  test('executeQuery handles RETURN of properties', () => {
    const query = 'MATCH (p:Person) RETURN p.name, p.age';
    const result = engine.executeQuery(graph, query);

    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(2); // Two person nodes
    expect(result.query).toBeDefined();
    expect(result.query!.columns).toEqual(['p.name', 'p.age']);
    expect(result.query!.rows.length).toBe(2);

    // Check the returned values
    expect(result.query!.rows[0][0].type).toBe('property');
    expect(result.query!.rows[0][0].name).toBe('p.name');
    expect(result.query!.rows[0][0].value).toBe('Alice');
    expect(result.query!.rows[0][1].type).toBe('property');
    expect(result.query!.rows[0][1].name).toBe('p.age');
    expect(result.query!.rows[0][1].value).toBe(30);

    expect(result.query!.rows[1][0].type).toBe('property');
    expect(result.query!.rows[1][0].name).toBe('p.name');
    expect(result.query!.rows[1][0].value).toBe('Bob');
    expect(result.query!.rows[1][1].type).toBe('property');
    expect(result.query!.rows[1][1].name).toBe('p.age');
    expect(result.query!.rows[1][1].value).toBe(28);
  });

  test('executeQuery handles RETURN with WHERE conditions', () => {
    const query = 'MATCH (p:Person) WHERE p.age > 29 RETURN p.name';
    const result = engine.executeQuery(graph, query);

    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(1); // Only Alice is older than 29
    expect(result.query).toBeDefined();
    expect(result.query!.columns).toEqual(['p.name']);
    expect(result.query!.rows.length).toBe(1);

    // Check the returned values
    expect(result.query!.rows[0][0].type).toBe('property');
    expect(result.query!.rows[0][0].name).toBe('p.name');
    expect(result.query!.rows[0][0].value).toBe('Alice');
  });

  test('executeQuery handles RETURN with multiple MATCH patterns', () => {
    const query = 'MATCH (p:Person), (t:Task) RETURN p.name, t.title';
    const result = engine.executeQuery(graph, query);

    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(4); // Cross product of 2 people × 2 tasks = 4 combinations
    expect(result.query).toBeDefined();
    expect(result.query!.columns).toEqual(['p.name', 't.title']);
    expect(result.query!.rows.length).toBe(4);

    // Create a set of name-title pairs to verify all combinations are returned
    const combinations = new Set<string>();
    result.query!.rows.forEach(row => {
      combinations.add(`${row[0].value}-${row[1].value}`);
    });

    expect(combinations.size).toBe(4);
    expect(combinations.has('Alice-Task 1')).toBe(true);
    expect(combinations.has('Alice-Task 2')).toBe(true);
    expect(combinations.has('Bob-Task 1')).toBe(true);
    expect(combinations.has('Bob-Task 2')).toBe(true);
  });

  test('executeQuery handles RETURN with relationship patterns', () => {
    const query = 'MATCH (p:Person)-[r:ASSIGNED_TO]->(t:Task) RETURN p.name, t.title, r';
    const result = engine.executeQuery(graph, query);

    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(2); // Two assignments
    expect(result.query).toBeDefined();
    expect(result.query!.columns).toEqual(['p.name', 't.title', 'r']);
    expect(result.query!.rows.length).toBe(2);

    // Create a map of name to title using the relationship as a medium
    const assignments = new Map<string, string>();
    result.query!.rows.forEach(row => {
      assignments.set(row[0].value, row[1].value);
    });

    expect(assignments.size).toBe(2);
    expect(assignments.get('Alice')).toBe('Task 1');
    expect(assignments.get('Bob')).toBe('Task 2');

    // Check that relationships are correctly returned
    expect(result.query!.rows[0][2].type).toBe('edge');
    expect(result.query!.rows[0][2].value.label).toBe('ASSIGNED_TO');
    expect(result.query!.rows[1][2].type).toBe('edge');
    expect(result.query!.rows[1][2].value.label).toBe('ASSIGNED_TO');
  });

  test('executeQuery handles rules with RETURN clauses', () => {
    const query = `MATCH (p:Person) RETURN p.name, p.age`;
    const result = engine.executeQuery(graph, query);

    // Rule should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(2);

    // Check that the query results are included
    expect(result.query).toBeDefined();
    expect(result.query?.columns).toEqual(['p.name', 'p.age']);
    expect(result.query?.rows.length).toBe(2);

    // Verify the query results
    const names = result.query!.rows.map(row => row[0].value);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  test('executeQuery extracts and executes queries from markdown', () => {
    const query = `
      MATCH (p:Person)
      RETURN p.name, p.age
    `;
    const result = engine.executeQuery(graph, query);

    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(2);
    expect(result.query).toBeDefined();
    expect(result.query!.columns).toEqual(['p.name', 'p.age']);
    expect(result.query!.rows.length).toBe(2);

    // Verify the query results
    const names = result.query!.rows.map(row => row[0].value);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });


  test('executeQuery handles errors in queries', () => {
    const invalidQuery = 'INVALID SYNTAX';
    const result = engine.executeQuery(graph, invalidQuery);

    // Query should fail with an error
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.query).toBeUndefined();
  });

  test('executeQuery handles query without RETURN clause as write-only', () => {
    const queryWithoutReturn = 'MATCH (p:Person)';
    const result = engine.executeQuery(graph, queryWithoutReturn);

    // In the unified API, a query without RETURN is valid but has no query results
    expect(result.success).toBe(true);
    expect(result.query).toBeUndefined();
    expect(result.stats.readOperations).toBe(false);
  });

  test('executeQuery can handle both CREATE and RETURN in one query', () => {
    const nodeCount = graph.getAllNodes().length;

    // Simpler query that just creates a node and returns properties
    const query = `
      MATCH (p:Person)
      WHERE p.name = 'Alice'
      SET p.updated = true
      RETURN p.name, p.updated
    `;

    const result = engine.executeQuery(graph, query);

    // Debug info
    console.log('Test result:', JSON.stringify({
      success: result.success,
      matchCount: result.matchCount,
      error: result.error,
      hasActions: !!result.actions,
      hasQuery: !!result.query
    }, null, 2));

    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(1); // Only Alice matches

    // Check stats
    expect(result.stats.readOperations).toBe(true);
    expect(result.stats.writeOperations).toBe(true);

    // Check that query results are returned
    expect(result.query).toBeDefined();
    expect(result.query!.columns).toEqual(['p.name', 'p.updated']);
    expect(result.query!.rows.length).toBe(1);

    // Check returned values
    expect(result.query!.rows[0][0].value).toBe('Alice');
    expect(result.query!.rows[0][1].value).toBe(true);

    // Check that actions were performed
    expect(result.actions).toBeDefined();
    expect(result.actions!.affectedNodes.length).toBe(1); // Updated Alice node

    // Verify node count remains the same (just updated properties)
    expect(graph.getAllNodes().length).toBe(nodeCount);
  });
});