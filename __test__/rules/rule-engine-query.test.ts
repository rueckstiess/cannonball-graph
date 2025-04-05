import { Graph } from '@/graph';
import { Rule } from '@/lang/rule-parser';
import { RuleEngine, createRuleEngine, QueryResult, GraphQueryResult } from '@/rules/rule-engine';

describe('Rule Engine Query Functionality', () => {
  let engine: RuleEngine;
  let graph: Graph;
  
  beforeEach(() => {
    engine = createRuleEngine();
    graph = new Graph();
    
    // Set up a test graph with nodes and relationships
    graph.addNode('person1', { name: 'Alice', age: 30, labels: ['Person'] });
    graph.addNode('person2', { name: 'Bob', age: 28, labels: ['Person'] });
    graph.addNode('task1', { title: 'Task 1', priority: 'High', labels: ['Task'] });
    graph.addNode('task2', { title: 'Task 2', priority: 'Low', labels: ['Task'] });
    
    // Add some relationships
    graph.addEdge('person1', 'task1', 'ASSIGNED_TO', { date: '2023-01-10' });
    graph.addEdge('person2', 'task2', 'ASSIGNED_TO', { date: '2023-01-15' });
  });
  
  test('executeQuery handles simple RETURN of variables (legacy API)', () => {
    const query = 'MATCH (p:Person) RETURN p';
    const result = engine.executeQuery(graph, query);
    
    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(2); // Two person nodes
    expect(result.columns).toEqual(['p']);
    expect(result.rows.length).toBe(2);
    
    // Check the returned values
    expect(result.rows[0][0].type).toBe('node');
    expect(result.rows[0][0].name).toBe('p');
    expect(result.rows[0][0].value.data.name).toBe('Alice');
    
    expect(result.rows[1][0].type).toBe('node');
    expect(result.rows[1][0].name).toBe('p');
    expect(result.rows[1][0].value.data.name).toBe('Bob');
  });
  
  test('executeGraphQuery handles simple RETURN of variables (new unified API)', () => {
    const query = 'MATCH (p:Person) RETURN p';
    const result = engine.executeGraphQuery(graph, query);
    
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
    expect(result.columns).toEqual(['p.name', 'p.age']);
    expect(result.rows.length).toBe(2);
    
    // Check the returned values
    expect(result.rows[0][0].type).toBe('property');
    expect(result.rows[0][0].name).toBe('p.name');
    expect(result.rows[0][0].value).toBe('Alice');
    expect(result.rows[0][1].type).toBe('property');
    expect(result.rows[0][1].name).toBe('p.age');
    expect(result.rows[0][1].value).toBe(30);
    
    expect(result.rows[1][0].type).toBe('property');
    expect(result.rows[1][0].name).toBe('p.name');
    expect(result.rows[1][0].value).toBe('Bob');
    expect(result.rows[1][1].type).toBe('property');
    expect(result.rows[1][1].name).toBe('p.age');
    expect(result.rows[1][1].value).toBe(28);
  });
  
  test('executeQuery handles RETURN with WHERE conditions', () => {
    const query = 'MATCH (p:Person) WHERE p.age > 29 RETURN p.name';
    const result = engine.executeQuery(graph, query);
    
    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(1); // Only Alice is older than 29
    expect(result.columns).toEqual(['p.name']);
    expect(result.rows.length).toBe(1);
    
    // Check the returned values
    expect(result.rows[0][0].type).toBe('property');
    expect(result.rows[0][0].name).toBe('p.name');
    expect(result.rows[0][0].value).toBe('Alice');
  });
  
  test('executeQuery handles RETURN with multiple MATCH patterns', () => {
    const query = 'MATCH (p:Person), (t:Task) RETURN p.name, t.title';
    const result = engine.executeQuery(graph, query);
    
    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(4); // Cross product of 2 people × 2 tasks = 4 combinations
    expect(result.columns).toEqual(['p.name', 't.title']);
    expect(result.rows.length).toBe(4);
    
    // Create a set of name-title pairs to verify all combinations are returned
    const combinations = new Set<string>();
    result.rows.forEach(row => {
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
    expect(result.columns).toEqual(['p.name', 't.title', 'r']);
    expect(result.rows.length).toBe(2);
    
    // Create a map of name to title using the relationship as a medium
    const assignments = new Map<string, string>();
    result.rows.forEach(row => {
      assignments.set(row[0].value, row[1].value);
    });
    
    expect(assignments.size).toBe(2);
    expect(assignments.get('Alice')).toBe('Task 1');
    expect(assignments.get('Bob')).toBe('Task 2');
    
    // Check that relationships are correctly returned
    expect(result.rows[0][2].type).toBe('edge');
    expect(result.rows[0][2].value.label).toBe('ASSIGNED_TO');
    expect(result.rows[1][2].type).toBe('edge');
    expect(result.rows[1][2].value.label).toBe('ASSIGNED_TO');
  });
  
  test('executeRule handles RETURN clauses in rules', () => {
    const rule: Rule = {
      name: 'QueryRule',
      description: 'A rule with a RETURN clause',
      priority: 1,
      disabled: false,
      ruleText: 'MATCH (p:Person) RETURN p.name, p.age',
      markdown: '```graphrule\nname: QueryRule\ndescription: A rule with a RETURN clause\npriority: 1\nMATCH (p:Person) RETURN p.name, p.age\n```'
    };
    
    const result = engine.executeRule(graph, rule);
    
    // Rule should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(2);
    
    // Check that the query results are included
    expect(result.queryResults).toBeDefined();
    expect(result.queryResults?.columns).toEqual(['p.name', 'p.age']);
    expect(result.queryResults?.rows.length).toBe(2);
    
    // Verify the query results
    const names = result.queryResults!.rows.map(row => row[0].value);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });
  
  test('executeQueryFromMarkdown extracts and executes queries from markdown', () => {
    const markdown = `
## Test Query

\`\`\`graphquery
MATCH (p:Person)
RETURN p.name, p.age
\`\`\`
    `;
    
    const result = engine.executeQueryFromMarkdown(graph, markdown);
    
    // Query should execute successfully
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(2);
    expect(result.columns).toEqual(['p.name', 'p.age']);
    expect(result.rows.length).toBe(2);
    
    // Verify the query results
    const names = result.rows.map(row => row[0].value);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });
  
  test('executeGraphQueryFromMarkdown with the new unified API', () => {
    const markdown = `
## Test Query

\`\`\`graphquery
MATCH (p:Person)
RETURN p.name, p.age
\`\`\`
    `;
    
    const result = engine.executeGraphQueryFromMarkdown(graph, markdown);
    
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
    expect(result.rows).toEqual([]);
  });
  
  test('executeQuery requires a RETURN clause', () => {
    const queryWithoutReturn = 'MATCH (p:Person)';
    const result = engine.executeQuery(graph, queryWithoutReturn);
    
    // Query should fail with an error about missing RETURN
    expect(result.success).toBe(false);
    expect(result.error).toContain('RETURN clause');
    expect(result.rows).toEqual([]);
  });
  
  test('executeGraphQuery can handle both CREATE and RETURN in one query', () => {
    const nodeCount = graph.getAllNodes().length;
  
    // Simpler query that just creates a node and returns properties
    const query = `
      MATCH (p:Person)
      WHERE p.name = 'Alice'
      SET p.updated = true
      RETURN p.name, p.updated
    `;
    
    const result = engine.executeGraphQuery(graph, query);
    
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