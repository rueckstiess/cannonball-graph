import { Graph } from '@/graph';
import { ConditionEvaluator } from '@/lang/condition-evaluator';
import { NodePattern, PathPattern, RelationshipPattern } from '@/lang/pattern-matcher';
import { PatternMatcherWithConditions } from '@/lang/pattern-matcher-with-conditions';
import { ComparisonExpression, ComparisonOperator, Expression, LogicalExpression, LogicalOperator, WhereClause } from '@/lang/rule-parser';

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

  test('findMatchingNodesWithCondition filters nodes by condition', () => {
    // Create a condition that filters for people with age > 25
    const nodePattern: NodePattern = {
      variable: 'p',
      labels: ['Person'],
      properties: {}
    };

    const condition: ComparisonExpression = {
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
    };

    // Find matching nodes with the condition
    const matchingNodes = patternMatcher.findMatchingNodesWithCondition(
      graph,
      nodePattern,
      condition
    );

    // Should only match person1 (Alice, age 30)
    expect(matchingNodes.length).toBe(1);
    expect(matchingNodes[0].id).toBe('person1');

    // Test without condition (should match all Person nodes)
    const allPersonNodes = patternMatcher.findMatchingNodesWithCondition(
      graph,
      nodePattern
    );

    expect(allPersonNodes.length).toBe(2);
  });

  test('findMatchingRelationshipsWithCondition filters relationships by condition', () => {
    // Create a relationship pattern
    const relationshipPattern: RelationshipPattern = {
      variable: 'r',
      type: 'ASSIGNED',
      properties: {},
      direction: 'outgoing'
    };

    // Create a condition that filters for relationships with since date after 2023-02-01
    const condition: ComparisonExpression = {
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
    };

    // Find matching relationships with the condition
    const matchingRelationships = patternMatcher.findMatchingRelationshipsWithCondition(
      graph,
      relationshipPattern,
      condition,
      'person1'
    );

    // Should only match the relationship from person1 to task2 (since 2023-02-10)
    expect(matchingRelationships.length).toBe(1);
    expect(matchingRelationships[0].source).toBe('person1');
    expect(matchingRelationships[0].target).toBe('task2');

    // Test without condition (should match all ASSIGNED relationships from person1)
    const allRelationships = patternMatcher.findMatchingRelationshipsWithCondition(
      graph,
      relationshipPattern,
      undefined,
      'person1'
    );

    expect(allRelationships.length).toBe(2);
  });

  test('findMatchingPathsWithCondition filters paths by condition', () => {
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

    // Create a condition that combines node and relationship properties
    const condition: LogicalExpression = {
      type: 'logical',
      operator: LogicalOperator.AND,
      operands: [
        // Person age > 25
        {
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
        } as ComparisonExpression,
        // Task priority is High
        {
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
      ]
    };

    // Find matching paths with the condition
    const matchingPaths = patternMatcher.findMatchingPathsWithCondition(
      graph,
      pathPattern,
      condition
    );

    // Should only match the path from person1 (age 30) to task1 (priority High)
    expect(matchingPaths.length).toBe(1);
    expect(matchingPaths[0].nodes[0].id).toBe('person1');
    expect(matchingPaths[0].nodes[1].id).toBe('task1');

    // Test without condition (should match all Person-ASSIGNED->Task paths)
    const allPaths = patternMatcher.findMatchingPathsWithCondition(
      graph,
      pathPattern
    );

    expect(allPaths.length).toBe(3);
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
      pathPattern,
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
      pathPattern
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