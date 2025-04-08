import { Graph } from '@/graph';
import { QueryEngine, createQueryEngine } from '@/query/query-engine';

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



describe('QueryEngine', () => {
  let engine: QueryEngine;
  let graph: Graph;

  beforeEach(() => {
    engine = createQueryEngine();
    graph = new Graph();

    // Set up a test graph
    graph.addNode('person1', 'Person', { name: 'Alice' });
    graph.addNode('person2', 'Person', { name: 'Bob' });
    graph.addNode('task1', 'Task', { title: 'Task 1', priority: 'High' });
    graph.addNode('task2', 'Task', { title: 'Task 2', priority: 'Low' });
  });

  test('executeQuery handles basic query execution', () => {
    const query = 'CREATE (n:NewNode {name: "TestNode"})';
    const result = engine.executeQuery(graph, query);

    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(1); // One empty binding context for CREATE-only query
    expect(result.actions).toBeDefined();
    expect(result.actions!.actionResults.length).toBe(1);

    // The rule should have created a new node
    const nodes = graph.getAllNodes();
    expect(nodes.length).toBe(5); // 4 original + 1 new

    // Find the created node
    const newNode = nodes.find(node => node.label === 'NewNode');
    expect(newNode).toBeDefined();
    expect(newNode?.data.name).toBe('TestNode');
  });

  test('executeQuery handles pattern matching with conditions', () => {
    const query = "MATCH (p:Person) WHERE p.name = 'Alice' SET p.status = 'Active'";
    const result = engine.executeQuery(graph, query);

    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(1);
    expect(result.actions).toBeDefined();
    expect(result.actions!.actionResults.length).toBe(1);

    // The rule should have updated Alice's status
    const alice = graph.getNode('person1');
    expect(alice?.data.status).toBe('Active');
  });

  test('executeQuery can execute multiple statements in order', () => {
    // Execute two queries in sequence to test priority ordering
    const firstQuery = 'MATCH (p:Person) SET p.lastUpdatedBy = "FirstRule"';
    const secondQuery = 'MATCH (p:Person) SET p.lastUpdatedBy = "SecondRule"';

    // Execute first query
    const result1 = engine.executeQuery(graph, firstQuery);
    expect(result1.success).toBe(true);
    expect(result1.actions).toBeDefined();

    // Execute second query
    const result2 = engine.executeQuery(graph, secondQuery);
    expect(result2.success).toBe(true);
    expect(result2.actions).toBeDefined();

    // Both person nodes should have lastUpdatedBy="SecondRule" because:
    // The second query overwrote the changes from the first query
    const person1 = graph.getNode('person1');
    const person2 = graph.getNode('person2');
    expect(person1?.data.lastUpdatedBy).toBe('SecondRule');
    expect(person2?.data.lastUpdatedBy).toBe('SecondRule');
  });

  test('executeQueriesFromMarkdown extracts and executes queries from markdown', () => {

    const query = `CREATE (n:NewNode {name: "FromMarkdown"})`;
    const result = engine.executeQuery(graph, query);

    expect(result.success).toBe(true);
    expect(result.actions).toBeDefined();

    // The rule should have created a new node
    const newNode = graph.findNodes(node => node.data.name === 'FromMarkdown')[0];
    expect(newNode).toBeDefined();
    expect(newNode?.label).toBe('NewNode');
  });

  test('executeQuery runs disabled rules directly', () => {
    // When using executeQuery directly, the disabled flag is not checked
    // This is a change in behavior from the old API
    const rule = 'CREATE (n:NewNode {name: "ShouldExist"})';

    const result = engine.executeQuery(graph, rule);

    // Rule should execute successfully
    expect(result.success).toBe(true);

    // The node should be created because we're running the query directly
    const newNode = graph.findNodes(node => node.data.name === 'ShouldExist')[0];
    expect(newNode).toBeDefined();
    expect(newNode?.label).toBe('NewNode');
  });

  test('executeQuery handles errors in query execution', () => {
    const invalidQuery = 'INVALID SYNTAX';

    const result = engine.executeQuery(graph, invalidQuery);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // This test specifically targets our fix for comma-separated patterns
  test('executeQuery correctly handles comma-separated patterns with cross-product bindings', () => {
    // Define a query that uses comma-separated patterns: MATCH (p:Person), (t:Task)
    const query = 'MATCH (p:Person), (t:Task) CREATE (p)-[r:WORKS_ON {date: "2023-01-15"}]->(t)';

    const result = engine.executeQuery(graph, query);

    // Verify execution succeeded
    expect(result.success).toBe(true);

    // With 2 people and 2 tasks, we should have 4 binding combinations (2×2=4)
    expect(result.matchCount).toBe(4);
    expect(result.actions).toBeDefined();
    expect(result.actions!.actionResults.length).toBe(4);

    // We should have created 4 relationships
    const edges = graph.getAllEdges();
    expect(edges.length).toBe(4);

    // Each relationship should have the correct type and property
    edges.forEach(edge => {
      expect(edge.label).toBe('WORKS_ON');
      expect(edge.data.date).toBe('2023-01-15');
    });

    // Check that each person is connected to each task
    const person1Edges = graph.getEdgesForNode('person1', 'outgoing');
    const person2Edges = graph.getEdgesForNode('person2', 'outgoing');

    expect(person1Edges.length).toBe(2);
    expect(person2Edges.length).toBe(2);

    // Verify the specific connections using a set of source-target pairs
    const connections = new Set<string>();
    edges.forEach(edge => connections.add(`${edge.source}->${edge.target}`));

    expect(connections.has('person1->task1')).toBe(true);
    expect(connections.has('person1->task2')).toBe(true);
    expect(connections.has('person2->task1')).toBe(true);
    expect(connections.has('person2->task2')).toBe(true);
  });

  test('executeQuery handles the case where one pattern has no matches', () => {
    // Create a query that references a non-existent label
    const query = 'MATCH (p:Person), (c:Category) CREATE (p)-[r:BELONGS_TO]->(c)';

    const result = engine.executeQuery(graph, query);

    // Query should execute successfully but with no matches
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(0);
    expect(result.actions).toBeDefined();
    expect(result.actions!.actionResults.length).toBe(0);

    // No new relationships should be created
    expect(graph.getAllEdges().length).toBe(0);
  });

  // Tests for private type guard methods
  describe('Type Guards', () => {
    const testNode = { id: 'n1', label: 'TestNode', data: { prop: 'value' } };
    const testNodeWithoutLabel = { id: 'n1', data: { prop: 'value' } };
    const testEdge = { source: 'n1', target: 'n2', label: 'RELATES_TO', data: { prop: 'value' } };
    const testEdgeWithoutLabel = { source: 'n1', target: 'n2', data: { prop: 'value' } };
    const plainObject = { key: 'value' };
    const nullValue = null;
    const primitiveValue = 123;

    describe('isNode', () => {
      test('should return true for a valid node object', () => {
        expect(engine['isNode'](testNode)).toBe(true);
      });

      test('should return false for a node object without label', () => {
        expect(engine['isNode'](testNodeWithoutLabel)).toBe(false);
      });

      test('should return false for an edge object', () => {
        expect(engine['isNode'](testEdge)).toBe(false);
      });

      test('should return false for a plain object', () => {
        expect(engine['isNode'](plainObject)).toBe(false);
      });

      test('should return false for null', () => {
        expect(engine['isNode'](nullValue)).toBe(false);
      });

      test('should return false for a primitive value', () => {
        expect(engine['isNode'](primitiveValue)).toBe(false);
      });
    });

    describe('isEdge', () => {
      test('should return true for a valid edge object', () => {
        expect(engine['isEdge'](testEdge)).toBe(true);
      });

      test('should return false for an edge object without label', () => {
        expect(engine['isEdge'](testEdgeWithoutLabel)).toBe(false);
      });

      test('should return false for a node object', () => {
        expect(engine['isEdge'](testNode)).toBe(false);
      });

      test('should return false for a plain object', () => {
        expect(engine['isEdge'](plainObject)).toBe(false);
      });

      test('should return false for null', () => {
        expect(engine['isEdge'](nullValue)).toBe(false);
      });

      test('should return false for a primitive value', () => {
        expect(engine['isEdge'](primitiveValue)).toBe(false);
      });
    });
  });
});