import { Graph } from '@/graph';
import { Lexer } from '@/lang/lexer';
import { Parser } from '@/lang/parser';
import { PatternMatcherWithConditions } from '@/lang/pattern-matcher-with-conditions';
import { BindingContext } from '@/lang/condition-evaluator';

// Helper function to execute a query and return bindings
const executeQuery = (graph: Graph, query: string): BindingContext[] => {
  const lexer = new Lexer();
  const parser = new Parser(lexer, query);
  const statement = parser.parse();
  const errors = parser.getErrors();

  if (errors.length > 0) {
    throw new Error(`Parsing failed: ${errors.join(', ')}`);
  }

  if (!statement.match) {
    throw new Error("Query must contain a MATCH clause");
  }

  // Use PatternMatcherWithConditions which now implements pushdown
  const matcher = new PatternMatcherWithConditions();
  // Assuming the first pattern is the main one for execution
  const results = matcher.executeMatchQuery(graph, statement.match.patterns, statement.where);

  return results;
};


describe('End-to-End Query Execution', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
    // Add sample data relevant to the tests
    graph.addNode('p1', 'person', { name: 'Alice', age: 30 });
    graph.addNode('p2', 'person', { name: 'Bob', age: 25 });
    graph.addNode('p3', 'person', { name: 'Dave', age: 40 }); // Added Dave
    graph.addNode('t1', 'task', { name: 'Fix bug', status: 'open' });
    graph.addNode('t2', 'task', { name: 'Write docs', status: 'closed' });
    graph.addNode('t3', 'task', { name: 'Deploy app', status: 'open' }); // Added Deploy app task
    graph.addNode('proj1', 'project', { name: 'Project X' });

    graph.addEdge('p1', 't1', 'ASSIGNED_TO', {});
    graph.addEdge('p2', 't2', 'ASSIGNED_TO', {});
    graph.addEdge('p3', 't3', 'ASSIGNED_TO', {}); // Dave assigned to Deploy app
    graph.addEdge('t1', 'proj1', 'PART_OF', {});
    graph.addEdge('t2', 'proj1', 'PART_OF', {});
    graph.addEdge('t3', 'proj1', 'PART_OF', {}); // Deploy app part of Project X
    graph.addEdge('p1', 'p2', 'KNOWS', {});
    graph.addEdge('p3', 'p1', 'KNOWS', {}); // Dave knows Alice
  });

  test('Simple MATCH node pattern', () => {
    const query = "MATCH (p:person) RETURN p";
    const results = executeQuery(graph, query);
    expect(results).toHaveLength(3);
    expect(results.map(b => b.get('p')?.id)).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
  });

  test('MATCH node pattern with properties', () => {
    const query = "MATCH (p:person {name: 'Alice'}) RETURN p";
    const results = executeQuery(graph, query);
    expect(results).toHaveLength(1);
    expect(results[0].get('p')?.id).toBe('p1');
  });

  test('MATCH node pattern with WHERE clause', () => {
    const query = "MATCH (p:person) WHERE p.age > 28 RETURN p";
    const results = executeQuery(graph, query);
    expect(results).toHaveLength(2); // Alice (30) and Dave (40)
    expect(results.map(b => b.get('p')?.id)).toEqual(expect.arrayContaining(['p1', 'p3']));
  });

  test('MATCH path pattern', () => {
    const query = "MATCH (p:person)-[:ASSIGNED_TO]->(t:task) RETURN p, t";
    const results = executeQuery(graph, query);
    expect(results).toHaveLength(3);
    // Check specific bindings if needed
    const p1t1 = results.find(b => b.get('p')?.id === 'p1' && b.get('t')?.id === 't1');
    const p2t2 = results.find(b => b.get('p')?.id === 'p2' && b.get('t')?.id === 't2');
    const p3t3 = results.find(b => b.get('p')?.id === 'p3' && b.get('t')?.id === 't3');
    expect(p1t1).toBeDefined();
    expect(p2t2).toBeDefined();
    expect(p3t3).toBeDefined();
  });

  test('MATCH path pattern with WHERE clause on node', () => {
    const query = "MATCH (p:person)-[:ASSIGNED_TO]->(t:task) WHERE p.name = 'Bob' RETURN p, t";
    const results = executeQuery(graph, query);
    expect(results).toHaveLength(1);
    expect(results[0].get('p')?.id).toBe('p2');
    expect(results[0].get('t')?.id).toBe('t2');
  });

  test('MATCH path pattern with WHERE clause on relationship (not supported yet)', () => {
    // Assuming relationship properties aren't filterable yet by WHERE
    // Add a property to an edge first if needed
    graph.updateEdge('p1', 't1', 'ASSIGNED_TO', { priority: 1 });
    const query = "MATCH (p:person)-[r:ASSIGNED_TO]->(t:task) WHERE r.priority = 1 RETURN p, t";
    // Expect this to potentially fail or return all ASSIGNED_TO if WHERE on rels isn't pushed down
    // For now, let's assume it works correctly with pushdown
    const results = executeQuery(graph, query);
    expect(results).toHaveLength(1);
    expect(results[0].get('p')?.id).toBe('p1');
    expect(results[0].get('t')?.id).toBe('t1');
  });

  test('MATCH with two comma-separated expressions and where clause', () => {
    const query = `
      MATCH (p:person), (t:task)
      WHERE p.name = "Dave" AND t.name = "Deploy app"
      RETURN p, t
    `;
    const results = executeQuery(graph, query);
    // Previously, this might have returned 0 due to evaluation order.
    // With predicate pushdown, it should find Dave, find Deploy app,
    // and then return the single combination.
    expect(results).toHaveLength(1); // <<< MODIFIED ASSERTION
    expect(results[0].get('p')?.id).toBe('p3');
    expect(results[0].get('p')?.data.name).toBe('Dave');
    expect(results[0].get('t')?.id).toBe('t3');
    expect(results[0].get('t')?.data.name).toBe('Deploy app');
  });

  test('MATCH path with multi-variable WHERE clause (predicate pushdown test)', () => {
    // Add age to tasks for testing
    graph.updateNodeData('t1', { age_limit: 35 }); // Fix bug limit 35
    graph.updateNodeData('t3', { age_limit: 45 }); // Deploy app limit 45

    const query = `
      MATCH (p:person)-[:ASSIGNED_TO]->(t:task)
      WHERE p.age < t.age_limit
      RETURN p, t
    `;
    const results = executeQuery(graph, query);
    // Expected results:
    // - Alice (30) -> t1 (limit 35) - YES
    // - Bob (25) -> t2 (no limit) - NO (age_limit is undefined, comparison fails)
    // - Dave (40) -> t3 (limit 45) - YES
    expect(results).toHaveLength(2);
    const aliceResult = results.find(b => b.get('p')?.id === 'p1');
    const daveResult = results.find(b => b.get('p')?.id === 'p3');
    expect(aliceResult).toBeDefined();
    expect(aliceResult?.get('t')?.id).toBe('t1');
    expect(daveResult).toBeDefined();
    expect(daveResult?.get('t')?.id).toBe('t3');
  });

  test('MATCH with unbound variable in WHERE (should throw error)', () => { // Modified description
    // This tests if the evaluator handles unbound variables gracefully during pushdown
    const query = `
      MATCH (p:person)
      WHERE p.name = "Alice" AND t.status = "open" // 't' is not defined in MATCH
      RETURN p
    `;
    // Expect an error because 't' is used in WHERE but not defined in MATCH
    expect(() => executeQuery(graph, query)).toThrow(
      "Variable 't' used in WHERE clause is not defined in MATCH clause."
    );
  });

  // Add more tests for complex WHERE clauses, OR, NOT, EXISTS etc. as needed

});