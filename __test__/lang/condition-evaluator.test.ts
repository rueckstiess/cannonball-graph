// __test__/condition-evaluator.test.ts
import { Graph, Node, Edge } from '@/graph';
import {
  Expression, LiteralExpression, VariableExpression, PropertyExpression,
  ComparisonExpression, LogicalExpression, ExistsExpression,
  ComparisonOperator, LogicalOperator, PathPattern, PatternMatcher,
  ConditionEvaluator, BindingContext, EvaluationResult, ConditionEvaluatorOptions
} from '@/lang';


describe('ConditionEvaluator', () => {
  // Define test data types
  type TestNodeData = {
    name?: string;
    age?: number;
    active?: boolean;
    tags?: string[];
    level?: string;
    priority?: number;
  };

  type TestEdgeData = {
    since?: string;
    weight?: number;
    active?: boolean;
    primary?: boolean;
  };

  let graph: Graph<TestNodeData, TestEdgeData>;
  let evaluator: ConditionEvaluator<TestNodeData, TestEdgeData>;
  let bindings: BindingContext<TestNodeData, TestEdgeData>;

  beforeEach(() => {
    // Create a fresh graph for each test
    graph = new Graph<TestNodeData, TestEdgeData>();

    // Create people nodes
    graph.addNode('alice', 'person', { name: 'Alice', age: 30, active: true });
    graph.addNode('bob', 'person', { name: 'Bob', age: 25, active: false });
    graph.addNode('charlie', 'person', { name: 'Charlie', age: 35, active: true, level: 'senior' });

    // Create task nodes
    graph.addNode('task1', 'task', {
      name: 'Fix bug',
      priority: 1,
      active: true,
      tags: ['bug', 'critical']
    });
    graph.addNode('task2', 'task', {
      name: 'Write docs',
      priority: 2,
      active: false,
      tags: ['docs']
    });
    graph.addNode('task3', 'task', {
      name: 'Deploy app',
      priority: 3,
      active: true,
      tags: ['deployment', 'critical']
    });

    // Create project nodes
    graph.addNode('proj1', 'project', { name: 'Project A', active: true });
    graph.addNode('proj2', 'project', { name: 'Project B', active: false });

    // Create relationships
    // Person -> Task (ASSIGNED)
    graph.addEdge('alice', 'task1', 'ASSIGNED', { since: '2023-01-01' });
    graph.addEdge('alice', 'task3', 'ASSIGNED', { since: '2023-02-15' });
    graph.addEdge('bob', 'task2', 'ASSIGNED', { since: '2023-03-10' });

    // Task -> Project (BELONGS_TO)
    graph.addEdge('task1', 'proj1', 'BELONGS_TO', { primary: true });
    graph.addEdge('task2', 'proj1', 'BELONGS_TO', { primary: true });
    graph.addEdge('task3', 'proj2', 'BELONGS_TO', { primary: true });

    // Person -> Person (KNOWS)
    graph.addEdge('alice', 'bob', 'KNOWS', { since: '2020-01-01', weight: 5 });
    graph.addEdge('bob', 'charlie', 'KNOWS', { since: '2021-06-15', weight: 3 });
    graph.addEdge('charlie', 'alice', 'KNOWS', { since: '2022-03-20', weight: 4 });

    // Create the condition evaluator with a pattern matcher
    const patternMatcher = new PatternMatcher<TestNodeData, TestEdgeData>();
    evaluator = new ConditionEvaluator<TestNodeData, TestEdgeData>();
    evaluator.setPatternMatcher(patternMatcher);

    // Create initial bindings
    bindings = new BindingContext<TestNodeData, TestEdgeData>();
  });

  // --- Existing tests ---
  describe('BindingContext', () => {
    // ... existing BindingContext tests ...
    it('should store and retrieve variable bindings', () => {
      const aliceNode = graph.getNode('alice')!;
      const bobNode = graph.getNode('bob')!;

      bindings.set('p1', aliceNode);
      bindings.set('p2', bobNode);

      expect(bindings.get('p1')).toBe(aliceNode);
      expect(bindings.get('p2')).toBe(bobNode);
    });

    it('should check if a variable is bound', () => {
      const aliceNode = graph.getNode('alice')!;

      bindings.set('p1', aliceNode);

      expect(bindings.has('p1')).toBe(true);
      expect(bindings.has('nonExistent')).toBe(false);
    });

    it('should create a child context that inherits from parent', () => {
      const aliceNode = graph.getNode('alice')!;
      const bobNode = graph.getNode('bob')!;

      bindings.set('p1', aliceNode);

      const childBindings = bindings.createChildContext();
      childBindings.set('p2', bobNode);

      // Child should see parent's bindings
      expect(childBindings.get('p1')).toBe(aliceNode);
      expect(childBindings.get('p2')).toBe(bobNode);

      // Parent should not see child's bindings
      expect(bindings.get('p2')).toBeUndefined();

      // Changes to child should not affect parent
      childBindings.set('p1', bobNode);
      expect(childBindings.get('p1')).toBe(bobNode);
      expect(bindings.get('p1')).toBe(aliceNode);
    });
  });

  describe('Literal Expression Evaluation', () => {
    // ... existing Literal Expression Evaluation tests ...
    it('should evaluate string literals', () => {
      const expr: LiteralExpression = {
        type: 'literal',
        value: 'test',
        dataType: 'string'
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe('test');
    });

    it('should evaluate number literals', () => {
      const expr: LiteralExpression = {
        type: 'literal',
        value: 42,
        dataType: 'number'
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(42);
    });

    it('should evaluate boolean literals', () => {
      const expr: LiteralExpression = {
        type: 'literal',
        value: true,
        dataType: 'boolean'
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });

    it('should evaluate null literals', () => {
      const expr: LiteralExpression = {
        type: 'literal',
        value: null,
        dataType: 'null'
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBeNull();
    });
  });

  describe('Variable Expression Evaluation', () => {
    // ... existing Variable Expression Evaluation tests ...
    it('should retrieve bound variables', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      const expr: VariableExpression = {
        type: 'variable',
        name: 'p'
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(aliceNode);
    });

    it('should return undefined for unbound variables', () => {
      const expr: VariableExpression = {
        type: 'variable',
        name: 'nonExistent'
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBeUndefined();
    });
  });

  describe('Property Expression Evaluation', () => {
    // ... existing Property Expression Evaluation tests ...
    it('should access node properties', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      const expr: PropertyExpression = {
        type: 'property',
        object: {
          type: 'variable',
          name: 'p'
        },
        property: 'name'
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe('Alice');
    });

    it('should access edge properties', () => {
      const knowsEdge = graph.getEdge('alice', 'bob', 'KNOWS')!;
      bindings.set('r', knowsEdge);

      const expr: PropertyExpression = {
        type: 'property',
        object: {
          type: 'variable',
          name: 'r'
        },
        property: 'weight'
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(5);
    });

    it('should return undefined for non-existent properties', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      const expr: PropertyExpression = {
        type: 'property',
        object: {
          type: 'variable',
          name: 'p'
        },
        property: 'nonExistent'
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBeUndefined();
    });

    it('should return undefined for properties on undefined variables', () => {
      const expr: PropertyExpression = {
        type: 'property',
        object: {
          type: 'variable',
          name: 'nonExistent'
        },
        property: 'name'
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBeUndefined();
    });
  });

  describe('Comparison Expression Evaluation', () => {
    // ... existing Comparison Expression Evaluation tests ...
    it('should evaluate equality comparison (=)', () => {
      // Create test for node.name = 'Alice'
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'name'
        },
        operator: ComparisonOperator.EQUALS,
        right: {
          type: 'literal',
          value: 'Alice',
          dataType: 'string'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);

      // Test for inequality
      const expr2: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'name'
        },
        operator: ComparisonOperator.EQUALS,
        right: {
          type: 'literal',
          value: 'Bob',
          dataType: 'string'
        }
      };

      const result2 = evaluator.evaluateExpression(graph, expr2, bindings);
      expect(result2).toBe(false);
    });

    it('should evaluate inequality comparison (<>)', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'name'
        },
        operator: ComparisonOperator.NOT_EQUALS,
        right: {
          type: 'literal',
          value: 'Bob',
          dataType: 'string'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });

    it('should evaluate less than comparison (<)', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'age'
        },
        operator: ComparisonOperator.LESS_THAN,
        right: {
          type: 'literal',
          value: 35,
          dataType: 'number'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });

    it('should evaluate less than or equal comparison (<=)', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'age'
        },
        operator: ComparisonOperator.LESS_THAN_OR_EQUALS,
        right: {
          type: 'literal',
          value: 30,
          dataType: 'number'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });

    it('should evaluate greater than comparison (>)', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'age'
        },
        operator: ComparisonOperator.GREATER_THAN,
        right: {
          type: 'literal',
          value: 25,
          dataType: 'number'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });

    it('should evaluate greater than or equal comparison (>=)', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'age'
        },
        operator: ComparisonOperator.GREATER_THAN_OR_EQUALS,
        right: {
          type: 'literal',
          value: 30,
          dataType: 'number'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });

    it('should evaluate CONTAINS operator', () => {
      // Test with string contains
      const task1Node = graph.getNode('task1')!;
      bindings.set('t', task1Node);

      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 't' },
          property: 'name'
        },
        operator: ComparisonOperator.CONTAINS,
        right: {
          type: 'literal',
          value: 'bug',
          dataType: 'string'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);

      // Test with array contains
      const expr2: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 't' },
          property: 'tags'
        },
        operator: ComparisonOperator.CONTAINS,
        right: {
          type: 'literal',
          value: 'critical',
          dataType: 'string'
        }
      };

      const result2 = evaluator.evaluateExpression(graph, expr2, bindings);
      expect(result2).toBe(true);
    });

    it('should evaluate STARTS WITH operator', () => {
      const task1Node = graph.getNode('task1')!;
      bindings.set('t', task1Node);

      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 't' },
          property: 'name'
        },
        operator: ComparisonOperator.STARTS_WITH,
        right: {
          type: 'literal',
          value: 'Fix',
          dataType: 'string'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });

    it('should evaluate ENDS WITH operator', () => {
      const task1Node = graph.getNode('task1')!;
      bindings.set('t', task1Node);

      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 't' },
          property: 'name'
        },
        operator: ComparisonOperator.ENDS_WITH,
        right: {
          type: 'literal',
          value: 'bug',
          dataType: 'string'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });

    // it('should evaluate IN operator', () => {
    //   const aliceNode = graph.getNode('alice')!;
    //   bindings.set('p', aliceNode);

    //   // Test for value in array literal
    //   const expr: ComparisonExpression = {
    //     type: 'comparison',
    //     left: {
    //       type: 'property',
    //       object: { type: 'variable', name: 'p' },
    //       property: 'name'
    //     },
    //     operator: ComparisonOperator.IN,
    //     right: {
    //       type: 'literal',
    //       value: ['Alice', 'Bob'],
    //       dataType: 'array'
    //     }
    //   };

    //   const result = evaluator.evaluateExpression(graph, expr, bindings);
    //   expect(result).toBe(true);
    // });

    it('should evaluate IS NULL operator', () => {
      const charlieNode = graph.getNode('charlie')!;
      bindings.set('p', charlieNode);

      // Charlie has level property
      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'level'
        },
        operator: ComparisonOperator.IS_NULL,
        right: {
          type: 'literal',
          value: null,
          dataType: 'null'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(false);

      // Alice doesn't have level property
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p2', aliceNode);

      const expr2: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p2' },
          property: 'level'
        },
        operator: ComparisonOperator.IS_NULL,
        right: {
          type: 'literal',
          value: null,
          dataType: 'null'
        }
      };

      const result2 = evaluator.evaluateExpression(graph, expr2, bindings);
      expect(result2).toBe(true);
    });

    it('should evaluate IS NOT NULL operator', () => {
      const charlieNode = graph.getNode('charlie')!;
      bindings.set('p', charlieNode);

      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'level'
        },
        operator: ComparisonOperator.IS_NOT_NULL,
        right: {
          type: 'literal',
          value: null,
          dataType: 'null'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });

    it('should support type coercion when enabled', () => {
      // Create a condition evaluator with type coercion enabled
      const coercingEvaluator = new ConditionEvaluator<TestNodeData, TestEdgeData>({
        enableTypeCoercion: true
      });

      // Test with string to number coercion
      expect(coercingEvaluator.evaluateComparison('42', ComparisonOperator.EQUALS, 42)).toBe(true);
      expect(coercingEvaluator.evaluateComparison(42, ComparisonOperator.EQUALS, '42')).toBe(true);

      // Test with boolean coercion
      expect(coercingEvaluator.evaluateComparison(1, ComparisonOperator.EQUALS, true)).toBe(true);
      expect(coercingEvaluator.evaluateComparison('true', ComparisonOperator.EQUALS, true)).toBe(true);
      expect(coercingEvaluator.evaluateComparison(0, ComparisonOperator.EQUALS, false)).toBe(true);
      expect(coercingEvaluator.evaluateComparison('false', ComparisonOperator.EQUALS, false)).toBe(true);

      // Verify non-coercing evaluator behaves strictly
      const strictEvaluator = new ConditionEvaluator<TestNodeData, TestEdgeData>({
        enableTypeCoercion: false
      });

      expect(strictEvaluator.evaluateComparison('42', ComparisonOperator.EQUALS, 42)).toBe(false);
      expect(strictEvaluator.evaluateComparison(42, ComparisonOperator.EQUALS, '42')).toBe(false);
    });
  });

  describe('Logical Expression Evaluation', () => {
    // ... existing Logical Expression Evaluation tests ...
    it('should evaluate AND operator', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      // p.name = 'Alice' AND p.age = 30
      const expr: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.AND,
        operands: [
          {
            type: 'comparison',
            left: {
              type: 'property',
              object: { type: 'variable', name: 'p' },
              property: 'name'
            },
            operator: ComparisonOperator.EQUALS,
            right: {
              type: 'literal',
              value: 'Alice',
              dataType: 'string'
            }
          },
          {
            type: 'comparison',
            left: {
              type: 'property',
              object: { type: 'variable', name: 'p' },
              property: 'age'
            },
            operator: ComparisonOperator.EQUALS,
            right: {
              type: 'literal',
              value: 30,
              dataType: 'number'
            }
          }
        ]
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });
  });

  describe('Exists Expression Evaluation', () => {
    // ... existing Exists Expression Evaluation tests ...
    it('should evaluate EXISTS pattern check', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      // EXISTS (p)-[:KNOWS]->()
      const expr: ExistsExpression = {
        type: 'exists',
        positive: true,
        pattern: {
          start: {
            variable: 'p',
            labels: [],
            properties: {}
          },
          segments: [
            {
              relationship: {
                type: 'KNOWS',
                properties: {},
                direction: 'outgoing'
              },
              node: {
                labels: [],
                properties: {}
              }
            }
          ]
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);

      // EXISTS (p)-[:NONEXISTENT]->()
      const expr2: ExistsExpression = {
        type: 'exists',
        positive: true,
        pattern: {
          start: {
            variable: 'p',
            labels: [],
            properties: {}
          },
          segments: [
            {
              relationship: {
                type: 'NONEXISTENT',
                properties: {},
                direction: 'outgoing'
              },
              node: {
                labels: [],
                properties: {}
              }
            }
          ]
        }
      };

      const result2 = evaluator.evaluateExpression(graph, expr2, bindings);
      expect(result2).toBe(false);
    });

    it('should evaluate NOT EXISTS pattern check', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      // NOT EXISTS (p)-[:NONEXISTENT]->()
      const expr: ExistsExpression = {
        type: 'exists',
        positive: false,
        pattern: {
          start: {
            variable: 'p',
            labels: [],
            properties: {}
          },
          segments: [
            {
              relationship: {
                type: 'NONEXISTENT',
                properties: {},
                direction: 'outgoing'
              },
              node: {
                labels: [],
                properties: {}
              }
            }
          ]
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });

    it('should evaluate EXISTS with specific target node patterns', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      // EXISTS (p)-[:KNOWS]->(:person {active: false})
      const expr: ExistsExpression = {
        type: 'exists',
        positive: true,
        pattern: {
          start: {
            variable: 'p',
            labels: [],
            properties: {}
          },
          segments: [
            {
              relationship: {
                type: 'KNOWS',
                properties: {},
                direction: 'outgoing'
              },
              node: {
                labels: ['person'],
                properties: { active: false }
              }
            }
          ]
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true); // Because Bob is inactive
    });

    it('should evaluate EXISTS with multi-segment patterns', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      // EXISTS (p)-[:ASSIGNED]->()-[:BELONGS_TO]->(:project {name: 'Project B'})
      const expr: ExistsExpression = {
        type: 'exists',
        positive: true,
        pattern: {
          start: {
            variable: 'p',
            labels: [],
            properties: {}
          },
          segments: [
            {
              relationship: {
                type: 'ASSIGNED',
                properties: {},
                direction: 'outgoing'
              },
              node: {
                labels: [],
                properties: {}
              }
            },
            {
              relationship: {
                type: 'BELONGS_TO',
                properties: {},
                direction: 'outgoing'
              },
              node: {
                labels: ['project'],
                properties: { name: 'Project B' }
              }
            }
          ]
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true); // Alice -> task3 -> proj2 (Project B)
    });
  });

  describe('Complex WHERE Condition Evaluation', () => {
    // ... existing Complex WHERE Condition Evaluation tests ...
    it('should evaluate complex combined conditions', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      // p.name = 'Alice' AND (p.age > 25 OR EXISTS (p)-[:ASSIGNED]->(:task {active: true}))
      const existsPattern: PathPattern = {
        start: { variable: 'p', labels: [], properties: {} },
        segments: [{
          relationship: { type: 'ASSIGNED', properties: {}, direction: 'outgoing' },
          node: { labels: ['task'], properties: { active: true } }
        }]
      };

      const expr: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.AND,
        operands: [
          {
            type: 'comparison',
            left: {
              type: 'property',
              object: { type: 'variable', name: 'p' },
              property: 'name'
            },
            operator: ComparisonOperator.EQUALS,
            right: {
              type: 'literal',
              value: 'Alice',
              dataType: 'string'
            }
          },
          {
            type: 'logical',
            operator: LogicalOperator.OR,
            operands: [
              {
                type: 'comparison',
                left: {
                  type: 'property',
                  object: { type: 'variable', name: 'p' },
                  property: 'age'
                },
                operator: ComparisonOperator.GREATER_THAN,
                right: {
                  type: 'literal',
                  value: 25,
                  dataType: 'number'
                }
              },
              {
                type: 'exists',
                positive: true,
                pattern: existsPattern
              }
            ]
          }
        ]
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing properties gracefully', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      // p.nonExistent = 'something'
      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'nonExistent'
        },
        operator: ComparisonOperator.EQUALS,
        right: {
          type: 'literal',
          value: 'something',
          dataType: 'string'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(false);
    });

    it('should handle missing variables gracefully', () => {
      // nonExistent.name = 'Alice'
      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'nonExistent' },
          property: 'name'
        },
        operator: ComparisonOperator.EQUALS,
        right: {
          type: 'literal',
          value: 'Alice',
          dataType: 'string'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(false);
    });

    it('should handle comparison between incompatible types', () => {
      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      // p.name > 42 (string vs number)
      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'p' },
          property: 'name'
        },
        operator: ComparisonOperator.GREATER_THAN,
        right: {
          type: 'literal',
          value: 42,
          dataType: 'number'
        }
      };

      // Without type coercion, comparing string to number should return false
      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(false);
    });

    it('should handle null values in comparisons', () => {
      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'literal',
          value: null,
          dataType: 'null'
        },
        operator: ComparisonOperator.EQUALS,
        right: {
          type: 'literal',
          value: null,
          dataType: 'null'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true); // null = null should be true

      const expr2: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'literal',
          value: null,
          dataType: 'null'
        },
        operator: ComparisonOperator.EQUALS,
        right: {
          type: 'literal',
          value: 'something',
          dataType: 'string'
        }
      };

      const result2 = evaluator.evaluateExpression(graph, expr2, bindings);
      expect(result2).toBe(false); // null = 'something' should be false
    });

    it('should handle array values in property access', () => {
      const task1Node = graph.getNode('task1')!;
      bindings.set('t', task1Node);

      // t.tags[0] = 'bug'
      const expr: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 't' },
          property: 'tags'
        },
        operator: ComparisonOperator.CONTAINS,
        right: {
          type: 'literal',
          value: 'bug',
          dataType: 'string'
        }
      };

      const result = evaluator.evaluateExpression(graph, expr, bindings);
      expect(result).toBe(true);
    });
  });

  describe('Integration with PatternMatcher', () => {
    // ... existing Integration with PatternMatcher tests ...
    it('should work with WHERE clauses from parsed Cypher', () => {
      // Mock a WHERE clause from a Cypher parser
      const whereClause = {
        condition: {
          type: 'comparison' as 'comparison',
          left: {
            type: 'property' as 'property',
            object: { type: 'variable' as 'variable', name: 'p' },
            property: 'name'
          },
          operator: ComparisonOperator.EQUALS,
          right: {
            type: 'literal' as 'literal',
            value: 'Alice',
            dataType: 'string' as 'string'
          }
        }
      };

      const aliceNode = graph.getNode('alice')!;
      bindings.set('p', aliceNode);

      const result = evaluator.evaluateCondition(graph, whereClause.condition, bindings);
      expect(result).toBe(true);
    });

    it('should evaluate WHERE conditions on pattern matches', () => {
      // Test the ability to filter pattern matches using WHERE conditions

      // Set up the PatternMatcher to find all people
      const patternMatcher = new PatternMatcher<TestNodeData, TestEdgeData>();
      evaluator.setPatternMatcher(patternMatcher);

      // Find people with name = 'Alice'
      const nodePattern = {
        labels: ['person'],
        properties: {}
      };

      const whereCondition: ComparisonExpression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'n' },
          property: 'name'
        },
        operator: ComparisonOperator.EQUALS,
        right: {
          type: 'literal',
          value: 'Alice',
          dataType: 'string'
        }
      };

      // Find matching nodes
      const matchingNodes = patternMatcher.findMatchingNodes(graph, nodePattern);

      // Filter using WHERE condition
      const filteredNodes = matchingNodes.filter(node => {
        const nodeBindings = new BindingContext<TestNodeData, TestEdgeData>();
        nodeBindings.set('n', node);
        return evaluator.evaluateCondition(graph, whereCondition, nodeBindings);
      });

      expect(filteredNodes).toHaveLength(1);
      expect(filteredNodes[0].id).toBe('alice');
    });
  });

  // --- New tests for helper functions ---
  describe('getVariablesInExpression', () => {
    // This test suite assumes getVariablesInExpression will be added to ConditionEvaluator
    // or made available for testing.

    test('should return empty set for literal expression', () => {
      const expr: Expression = { type: 'literal', value: 10, dataType: 'number' };
      // Assuming evaluator has the method or it's imported/mocked
      expect((evaluator as any).getVariablesInExpression(expr)).toEqual(new Set());
    });

    test('should return variable name for variable expression', () => {
      const expr: Expression = { type: 'variable', name: 'n' };
      expect((evaluator as any).getVariablesInExpression(expr)).toEqual(new Set(['n']));
    });

    test('should return object variable name for property expression', () => {
      const expr: Expression = { type: 'property', object: { type: 'variable', name: 'p' }, property: 'name' };
      expect((evaluator as any).getVariablesInExpression(expr)).toEqual(new Set(['p']));
    });

    test('should return variables from both sides of comparison', () => {
      const expr: ComparisonExpression = {
        type: 'comparison',
        left: { type: 'property', object: { type: 'variable', name: 'a' }, property: 'age' },
        operator: ComparisonOperator.GREATER_THAN,
        right: { type: 'variable', name: 'b' }
      };
      expect((evaluator as any).getVariablesInExpression(expr)).toEqual(new Set(['a', 'b']));
    });

    test('should return variables from all operands of logical AND', () => {
      const expr: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.AND,
        operands: [
          { type: 'comparison', left: { type: 'variable', name: 'x' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 1, dataType: 'number' } },
          { type: 'comparison', left: { type: 'variable', name: 'y' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'a', dataType: 'string' } }
        ]
      };
      expect((evaluator as any).getVariablesInExpression(expr)).toEqual(new Set(['x', 'y']));
    });

    test('should return variables from nested logical expressions', () => {
      const expr: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.OR,
        operands: [
          { type: 'comparison', left: { type: 'variable', name: 'p' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: true, dataType: 'boolean' } },
          {
            type: 'logical',
            operator: LogicalOperator.AND,
            operands: [
              { type: 'comparison', left: { type: 'variable', name: 'q' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 1, dataType: 'number' } },
              { type: 'comparison', left: { type: 'variable', name: 'r' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'a', dataType: 'string' } }
            ]
          }
        ]
      };
      expect((evaluator as any).getVariablesInExpression(expr)).toEqual(new Set(['p', 'q', 'r']));
    });

    test('should return variables from EXISTS pattern', () => {
      const expr: ExistsExpression = {
        type: 'exists',
        positive: true,
        pattern: {
          start: { variable: 'a', labels: [], properties: {} },
          segments: [{
            relationship: { variable: 'r', type: 'KNOWS', properties: {}, direction: 'outgoing' },
            node: { variable: 'b', labels: [], properties: {} }
          }]
        }
      };
      expect((evaluator as any).getVariablesInExpression(expr)).toEqual(new Set(['a', 'r', 'b']));
    });

    test('should handle EXISTS pattern with missing variables', () => {
      const expr: ExistsExpression = {
        type: 'exists',
        positive: true,
        pattern: {
          start: { labels: ['Person'], properties: {} }, // No start variable
          segments: [{
            relationship: { type: 'KNOWS', properties: {}, direction: 'outgoing' }, // No rel variable
            node: { variable: 'friend', labels: [], properties: {} }
          }]
        }
      };
      expect((evaluator as any).getVariablesInExpression(expr)).toEqual(new Set(['friend']));
    });

    test('should return unique variables only', () => {
      const expr: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.AND,
        operands: [
          { type: 'comparison', left: { type: 'variable', name: 'x' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 1, dataType: 'number' } },
          { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 'x' }, property: 'prop' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'a', dataType: 'string' } }
        ]
      };
      expect((evaluator as any).getVariablesInExpression(expr)).toEqual(new Set(['x']));
    });
  });


  describe('analyzeWhereClause', () => {
    // This test suite assumes analyzeWhereClause will be added to ConditionEvaluator
    // or made available for testing.

    test('should categorize single variable comparison', () => {
      const condition: ComparisonExpression = {
        type: 'comparison',
        left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'name' },
        operator: ComparisonOperator.EQUALS,
        right: { type: 'literal', value: 'Dave', dataType: 'string' }
      };
      const { singleVariablePredicates, multiVariablePredicates } = (evaluator as any).analyzeWhereClause(condition);
      expect(multiVariablePredicates).toHaveLength(0);
      expect(singleVariablePredicates.size).toBe(1);
      expect(singleVariablePredicates.get('p')).toEqual([condition]);
    });

    test('should categorize multi-variable comparison', () => {
      const condition: ComparisonExpression = {
        type: 'comparison',
        left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'age' },
        operator: ComparisonOperator.GREATER_THAN,
        right: { type: 'property', object: { type: 'variable', name: 't' }, property: 'priority' }
      };
      const { singleVariablePredicates, multiVariablePredicates } = (evaluator as any).analyzeWhereClause(condition);
      expect(multiVariablePredicates).toEqual([condition]);
      expect(singleVariablePredicates.size).toBe(0);
    });

    test('should handle AND with two single-variable predicates for different vars', () => {
      const pCond: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'name' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'Dave', dataType: 'string' } };
      const tCond: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 't' }, property: 'status' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'open', dataType: 'string' } };
      const condition: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.AND,
        operands: [pCond, tCond]
      };
      const { singleVariablePredicates, multiVariablePredicates } = (evaluator as any).analyzeWhereClause(condition);
      expect(multiVariablePredicates).toHaveLength(0);
      expect(singleVariablePredicates.size).toBe(2);
      expect(singleVariablePredicates.get('p')).toEqual([pCond]);
      expect(singleVariablePredicates.get('t')).toEqual([tCond]);
    });

    test('should handle AND with two single-variable predicates for the same var', () => {
      const pCond1: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'name' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'Dave', dataType: 'string' } };
      const pCond2: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'age' }, operator: ComparisonOperator.GREATER_THAN, right: { type: 'literal', value: 30, dataType: 'number' } };
      const condition: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.AND,
        operands: [pCond1, pCond2]
      };
      const { singleVariablePredicates, multiVariablePredicates } = (evaluator as any).analyzeWhereClause(condition);
      expect(multiVariablePredicates).toHaveLength(0);
      expect(singleVariablePredicates.size).toBe(1);
      expect(singleVariablePredicates.get('p')).toEqual([pCond1, pCond2]); // Both conditions associated with 'p'
    });

    test('should handle AND with mixed single and multi-variable predicates', () => {
      const pCond: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'name' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'Dave', dataType: 'string' } };
      const multiCond: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'age' }, operator: ComparisonOperator.GREATER_THAN, right: { type: 'property', object: { type: 'variable', name: 't' }, property: 'priority' } };
      const condition: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.AND,
        operands: [pCond, multiCond]
      };
      const { singleVariablePredicates, multiVariablePredicates } = (evaluator as any).analyzeWhereClause(condition);
      expect(multiVariablePredicates).toEqual([multiCond]);
      expect(singleVariablePredicates.size).toBe(1);
      expect(singleVariablePredicates.get('p')).toEqual([pCond]);
    });

    test('should treat OR expression as multi-variable if operands use different vars', () => {
      const pCond: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'name' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'Dave', dataType: 'string' } };
      const tCond: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 't' }, property: 'status' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'open', dataType: 'string' } };
      const condition: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.OR,
        operands: [pCond, tCond]
      };
      const { singleVariablePredicates, multiVariablePredicates } = (evaluator as any).analyzeWhereClause(condition);
      // OR involving different variables cannot be pushed down individually
      expect(multiVariablePredicates).toEqual([condition]);
      expect(singleVariablePredicates.size).toBe(0);
    });

    test('should treat OR expression as single-variable if operands use the same var', () => {
      const pCond1: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'status' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'active', dataType: 'string' } };
      const pCond2: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'status' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'pending', dataType: 'string' } };
      const condition: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.OR,
        operands: [pCond1, pCond2]
      };
      const { singleVariablePredicates, multiVariablePredicates } = (evaluator as any).analyzeWhereClause(condition);
      // OR involving the same variable *can* be pushed down
      expect(multiVariablePredicates).toHaveLength(0);
      expect(singleVariablePredicates.size).toBe(1);
      expect(singleVariablePredicates.get('p')).toEqual([condition]);
    });

    test('should treat NOT expression based on its operand', () => {
      const pCond: ComparisonExpression = { type: 'comparison', left: { type: 'property', object: { type: 'variable', name: 'p' }, property: 'name' }, operator: ComparisonOperator.EQUALS, right: { type: 'literal', value: 'Dave', dataType: 'string' } };
      const condition: LogicalExpression = {
        type: 'logical',
        operator: LogicalOperator.NOT,
        operands: [pCond]
      };
      const { singleVariablePredicates, multiVariablePredicates } = (evaluator as any).analyzeWhereClause(condition);
      expect(multiVariablePredicates).toHaveLength(0);
      expect(singleVariablePredicates.size).toBe(1);
      expect(singleVariablePredicates.get('p')).toEqual([condition]); // The whole NOT expression is associated with 'p'
    });

    test('should treat EXISTS expression based on its pattern variables', () => {
      const existsPattern: PathPattern = {
        start: { variable: 'a', labels: [], properties: {} },
        segments: [{ relationship: { type: 'REL', properties: {}, direction: 'outgoing' }, node: { variable: 'b', labels: [], properties: {} } }]
      };
      const condition: ExistsExpression = { type: 'exists', positive: true, pattern: existsPattern };
      const { singleVariablePredicates, multiVariablePredicates } = (evaluator as any).analyzeWhereClause(condition);
      // EXISTS with multiple internal variables is treated as multi-variable for pushdown analysis
      expect(multiVariablePredicates).toEqual([condition]);
      expect(singleVariablePredicates.size).toBe(0);
    });

    test('should treat EXISTS expression with single pattern variable as single-variable', () => {
      const existsPattern: PathPattern = {
        start: { variable: 'a', labels: [], properties: {} }, // Only 'a' is used
        segments: [{ relationship: { type: 'REL', properties: {}, direction: 'outgoing' }, node: { labels: ['Task'], properties: {} } }]
      };
      const condition: ExistsExpression = { type: 'exists', positive: true, pattern: existsPattern };
      const { singleVariablePredicates, multiVariablePredicates } = (evaluator as any).analyzeWhereClause(condition);
      expect(multiVariablePredicates).toHaveLength(0);
      expect(singleVariablePredicates.size).toBe(1);
      expect(singleVariablePredicates.get('a')).toEqual([condition]);
    });

  });

}); // End of main describe block
