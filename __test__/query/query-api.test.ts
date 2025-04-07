import { Graph } from '@/graph';
import {
  createQueryEngine,
  createQueryFormatter,
  createQueryUtils,
  QueryFormatter,
  QueryUtils,
  QueryResult
} from '@/query';

describe('Query API', () => {
  let graph: Graph;
  let engine: any;
  let formatter: QueryFormatter;
  let utils: QueryUtils;

  beforeEach(() => {
    graph = new Graph();
    engine = createQueryEngine();
    formatter = createQueryFormatter();
    utils = createQueryUtils();

    // Set up a test graph
    graph.addNode('person1', 'Person', { name: 'Alice', age: 30 });
    graph.addNode('person2', 'Person', { name: 'Bob', age: 25 });
    graph.addNode('task1', 'Task', { title: 'Task 1', priority: 'High' });
    graph.addNode('task2', 'Task', { title: 'Task 2', priority: 'Low' });

    // Add some relationships
    graph.addEdge('person1', 'task1', 'ASSIGNED_TO', { date: '2023-01-15' });
    graph.addEdge('person2', 'task2', 'ASSIGNED_TO', { date: '2023-01-20' });
  });

  describe('Unified Query API', () => {
    test('executeQuery supports both read and write operations', () => {
      // Simpler query that sets a property and returns values
      const query = `
        MATCH (p:Person)
        WHERE p.name = 'Alice'
        SET p.updated = true
        RETURN p.name, p.updated
      `;

      const result = engine.executeQuery(graph, query);

      // Check that the result has both query and action data
      expect(result.success).toBe(true);
      expect(result.stats.readOperations).toBe(true);
      expect(result.stats.writeOperations).toBe(true);

      // Check query results
      expect(result.query).toBeDefined();
      expect(result.query!.columns).toEqual(['p.name', 'p.updated']);
      expect(result.query!.rows[0][0].value).toBe('Alice');
      expect(result.query!.rows[0][1].value).toBe(true);

      // Check action results
      expect(result.actions).toBeDefined();
      expect(result.actions!.affectedNodes.length).toBe(1);
    });

    test('QueryFormatter works with GraphQueryResult', () => {
      const result = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');

      // Check the markdown formatting
      const markdown = formatter.toMarkdownTable(result);
      expect(markdown).toContain('| p.name | p.age |');
      expect(markdown).toContain('| "Alice" | 30 |');

      // Check the JSON formatting
      const json = formatter.toJSON(result);
      const parsed = JSON.parse(json);
      expect(parsed.success).toBe(true);
      expect(parsed.matchCount).toBe(2);
      expect(parsed.query.length).toBe(2);

      // Check the text table formatting
      const textTable = formatter.toTextTable(result);
      expect(textTable).toContain('p.name');
      expect(textTable).toContain('p.age');
    });

    test('QueryUtils works with GraphQueryResult', () => {
      const result = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');

      // Check extractColumn works
      const names = utils.extractColumn(result, 'p.name');
      expect(names).toEqual(['Alice', 'Bob']);

      // Check toObjectArray works
      const objects = utils.toObjectArray(result);
      expect(objects.length).toBe(2);
      expect(objects[0]['p.name']).toBe('Alice');

      // Check isEmpty works
      expect(utils.isEmpty(result)).toBe(false);

      // Check getSingleValue works
      const emptyResult = engine.executeQuery(graph, 'MATCH (p:Person) WHERE p.age > 100 RETURN p');
      expect(utils.isEmpty(emptyResult)).toBe(true);
    });
  });

  describe('QueryFormatter', () => {
    test('toMarkdownTable formats query results as markdown', () => {
      const queryResult = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
      const markdown = formatter.toMarkdownTable(queryResult);

      // Check the markdown formatting
      expect(markdown).toContain('| p.name | p.age |');
      expect(markdown).toContain('| --- | --- |');
      expect(markdown).toContain('| "Alice" | 30 |');
      expect(markdown).toContain('| "Bob" | 25 |');
    });

    test('toTextTable formats query results as text table', () => {
      const queryResult = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
      const textTable = formatter.toTextTable(queryResult);

      // Check the text table formatting
      // Since the exact formatting may vary, we'll just check for key parts
      expect(textTable).toContain('p.name');
      expect(textTable).toContain('p.age');
      expect(textTable).toContain('"Alice"');
      expect(textTable).toContain('30');
      expect(textTable).toContain('"Bob"');
      expect(textTable).toContain('25');
    });

    test('toJSON formats query results as JSON', () => {
      const queryResult = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
      const json = formatter.toJSON(queryResult);
      const parsed = JSON.parse(json);

      // Check the JSON structure
      expect(parsed.matchCount).toBe(2);
      expect(parsed.query.length).toBe(2);
      expect(parsed.query[0]['p.name']).toBe('Alice');
      expect(parsed.query[0]['p.age']).toBe(30);
      expect(parsed.query[1]['p.name']).toBe('Bob');
      expect(parsed.query[1]['p.age']).toBe(25);
    });

    test('handles empty results gracefully', () => {
      const emptyResult = engine.executeQuery(graph, 'MATCH (p:Person) WHERE p.age > 100 RETURN p.name');

      expect(formatter.toMarkdownTable(emptyResult)).toBe('No results');
      expect(formatter.toTextTable(emptyResult)).toBe('No results');

      const json = formatter.toJSON(emptyResult);
      const parsed = JSON.parse(json);
      expect(parsed.matchCount).toBe(0);
      // In the unified API, query data is under the 'query' property
      expect(parsed.query === undefined || parsed.query.length === 0).toBe(true);
    });
  });

  describe('QueryUtils', () => {
    test('extractColumn extracts a specific column of values', () => {
      const queryResult = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
      const names = utils.extractColumn(queryResult, 'p.name');

      expect(names).toEqual(['Alice', 'Bob']);
    });

    test('toObjectArray converts query results to object array', () => {
      const queryResult = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
      const objects = utils.toObjectArray(queryResult);

      expect(objects.length).toBe(2);
      expect(objects[0]['p.name']).toBe('Alice');
      expect(objects[0]['p.age']).toBe(30);
      expect(objects[1]['p.name']).toBe('Bob');
      expect(objects[1]['p.age']).toBe(25);
    });

    test('extractNodes extracts nodes from query results', () => {
      const queryResult = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p');
      const nodes = utils.extractNodes(queryResult);

      expect(nodes.length).toBe(2);
      expect(nodes[0].data.name).toBe('Alice');
      expect(nodes[1].data.name).toBe('Bob');
    });

    test('extractEdges extracts edges from query results', () => {
      const queryResult = engine.executeQuery(graph, 'MATCH (p:Person)-[r:ASSIGNED_TO]->(t:Task) RETURN r');
      const edges = utils.extractEdges(queryResult);

      expect(edges.length).toBe(2);
      expect(edges[0].label).toBe('ASSIGNED_TO');
      expect(edges[0].data.date).toBe('2023-01-15');
      expect(edges[1].label).toBe('ASSIGNED_TO');
      expect(edges[1].data.date).toBe('2023-01-20');
    });

    test('toSubgraph creates a subgraph from query results', () => {
      const queryResult = engine.executeQuery(graph, 'MATCH (p:Person)-[r:ASSIGNED_TO]->(t:Task) RETURN p, r, t');
      const subgraph = utils.toSubgraph(queryResult);

      expect(subgraph.getAllNodes().length).toBe(4); // 2 people + 2 tasks
      expect(subgraph.getAllEdges().length).toBe(2); // 2 assignments
    });

    test('isEmpty checks if query results are empty', () => {
      const emptyResult = engine.executeQuery(graph, 'MATCH (p:Person) WHERE p.age > 100 RETURN p');
      const nonEmptyResult = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p');

      expect(utils.isEmpty(emptyResult)).toBe(true);
      expect(utils.isEmpty(nonEmptyResult)).toBe(false);
    });

    test('getSingleValue gets a single value from results', () => {
      const queryResult = engine.executeQuery(graph, 'MATCH (p:Person) WHERE p.name = "Alice" RETURN p.age');
      const age = utils.getSingleValue(queryResult);

      expect(age).toBe(30);
    });
  });
});