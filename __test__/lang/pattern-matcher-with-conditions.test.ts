import { Graph } from '@/graph';
import { ConditionEvaluator } from '@/lang/condition-evaluator';
import { NodePattern, PathPattern, RelationshipPattern } from '@/lang/pattern-matcher';
import { PatternMatcherWithConditions } from '@/lang/pattern-matcher-with-conditions';
import { ComparisonExpression, ComparisonOperator, Expression, LogicalExpression, LogicalOperator, WhereClause } from '@/lang/parser';

describe('PatternMatcherWithConditions', () => {
  let graph: Graph;
  let patternMatcher: PatternMatcherWithConditions;

  beforeEach(() => {
    graph = new Graph();
    patternMatcher = new PatternMatcherWithConditions();

    // Create test nodes
    graph.addNode('person1', 'Person', { name: 'Alice', age: 30 });
    graph.addNode('person2', 'Person', { name: 'Bob', age: 25 });
    graph.addNode('task1', 'Task', { title: 'Task 1', priority: 'High' });
    graph.addNode('task2', 'Task', { title: 'Task 2', priority: 'Low' });

    // Create relationships
    graph.addEdge('person1', 'task1', 'ASSIGNED', { since: '2023-01-15' });
    graph.addEdge('person1', 'task2', 'ASSIGNED', { since: '2023-02-10' });
    graph.addEdge('person2', 'task1', 'ASSIGNED', { since: '2023-03-05' });
  });

  test('executeMatchQuery filters nodes by condition', () => { // Renamed test
    // Create a pattern for a single node
    const pathPattern: PathPattern = {
      start: {
        variable: 'p',
        labels: ['Person'],
        properties: {}
      },
      segments: [] // No segments for a single node pattern
    };

    // Create a WHERE clause
    const whereClause: WhereClause = {
      condition: {
        type: 'comparison',
        operator: ComparisonOperator.GREATER_THAN,
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'age'
        },
        right: {
          type: 'literal',
          value: 25,
          dataType: 'number'
        }
      } as ComparisonExpression
    };

    // Execute the query with the condition
    const results = patternMatcher.executeMatchQuery(
      graph,
      [pathPattern], // Pass pattern array
      whereClause
    );

    // Should only match person1 (Alice, age 30)
    expect(results.length).toBe(1);
    expect(results[0].get('p')?.id).toBe('person1');

    // Test without condition (should match all Person nodes)
    const allPersonResults = patternMatcher.executeMatchQuery(
      graph,
      [pathPattern] // Pass pattern array without where clause
    );

    expect(allPersonResults.length).toBe(2);
  });

  test('executeMatchQuery filters relationships by condition', () => { // Renamed test
    // Create a path pattern to match the relationship
    const pathPattern: PathPattern = {
      start: {
        variable: 'p', // Need to match the start node
        labels: ['Person'],
        properties: {}
      },
      segments: [{
        relationship: {
          variable: 'r', // Bind the relationship
          type: 'ASSIGNED',
          properties: {},
          direction: 'outgoing'
        },
        node: {
          variable: 't', // Need to match the end node
          labels: ['Task'],
          properties: {}
        }
      }]
    };

    // Create a WHERE clause filtering on the relationship property 'since'
    const whereClause: WhereClause = {
      condition: {
        type: 'comparison',
        operator: ComparisonOperator.GREATER_THAN,
        left: {
          type: 'property',
          object: { type: 'variable', name: 'r' },
          property: 'since'
        },
        right: {
          type: 'literal',
          value: '2023-02-01',
          dataType: 'string'
        }
      } as ComparisonExpression
    };

    // Execute the query
    const results = patternMatcher.executeMatchQuery(
      graph,
      [pathPattern], // Pass pattern array
      whereClause
    );

    // Should match paths where the relationship 'since' > '2023-02-01'
    // - person1 -> task2 (since 2023-02-10) - YES
    // - person2 -> task1 (since 2023-03-05) - YES
    expect(results.length).toBe(2);

    // Check one of the results specifically
    const person1Task2Result = results.find(b => b.get('p')?.id === 'person1' && b.get('t')?.id === 'task2');
    expect(person1Task2Result).toBeDefined();
    expect(person1Task2Result?.get('r')?.data.since).toBe('2023-02-10');

    // Test without condition (should match all ASSIGNED relationships)
    const allResults = patternMatcher.executeMatchQuery(
      graph,
      [pathPattern] // Pass pattern array without where clause
    );

    expect(allResults.length).toBe(3);
  });

  test('executeMatchQuery finds paths and filters with WHERE clause', () => {
    // Create a path pattern
    const pathPattern: PathPattern = {
      start: {
        variable: 'p',
        labels: ['Person'],
        properties: {}
      },
      segments: [{
        relationship: {
          variable: 'r',
          type: 'ASSIGNED',
          properties: {},
          direction: 'outgoing'
        },
        node: {
          variable: 't',
          labels: ['Task'],
          properties: {}
        }
      }]
    };

    // Create a WHERE clause for the query
    const whereClause: WhereClause = {
      condition: {
        type: 'comparison',
        operator: ComparisonOperator.EQUALS,
        left: {
          type: 'property',
          object: { type: 'variable', name: 't' },
          property: 'priority'
        },
        right: {
          type: 'literal',
          value: 'High',
          dataType: 'string'
        }
      } as ComparisonExpression
    };

    // Execute the match query
    const results = patternMatcher.executeMatchQuery(
      graph,
      [pathPattern],
      whereClause
    );

    // Should return binding contexts for paths where task priority is High
    expect(results.length).toBe(2); // Two people assigned to the high-priority task

    // Verify bindings contain the correct variable mappings
    for (const bindings of results) {
      expect(bindings.has('p')).toBe(true);
      expect(bindings.has('r')).toBe(true);
      expect(bindings.has('t')).toBe(true);

      const task = bindings.get('t');
      expect(task.data.priority).toBe('High');
    }

    // Test without WHERE clause (should match all paths)
    const allResults = patternMatcher.executeMatchQuery(
      graph,
      [pathPattern]
    );

    expect(allResults.length).toBe(3);
  });

  test('getConditionEvaluator and setConditionEvaluator methods', () => {
    // Get the default condition evaluator
    const evaluator = patternMatcher.getConditionEvaluator();
    expect(evaluator).toBeDefined();

    // Create a new evaluator and set it
    const newEvaluator = new ConditionEvaluator({ enableTypeCoercion: true });
    patternMatcher.setConditionEvaluator(newEvaluator);

    // Get the evaluator again and verify it's the new one
    const updatedEvaluator = patternMatcher.getConditionEvaluator();
    expect(updatedEvaluator).toBe(newEvaluator);
  });
});