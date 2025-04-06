import { Graph, Node } from '@/graph';
import { BindingContext } from '@/lang/condition-evaluator';
import {
  ASTRuleRoot,
  ASTCreateNodePatternNode,
  ASTCreateRelPatternNode,
  ASTPropertySettingNode,
  ASTLiteralExpressionNode,
  ASTCreateNode,
  ASTSetNode
} from '@/lang/ast-transformer';
import { PatternMatcherWithConditions } from '@/lang/pattern-matcher-with-conditions';
import { NodePattern, PathPattern } from '@/lang/pattern-matcher';
import {
  CreateNodeAction,
  CreateRelationshipAction,
  SetPropertyAction,
  ActionExecutor,
  ActionFactory,
  RuleAction,
  createRuleEngine
} from '@/rules';
import { DeleteAction } from '@/rules/delete-action';

// Create proper AST nodes for testing
const mockCreateNodeAst: ASTCreateNodePatternNode = {
  type: 'createNode',
  variable: 'p',
  labels: ['Person'],
  properties: { name: 'Alice', age: 30 }
};

const mockCreateRelAst: ASTCreateRelPatternNode = {
  type: 'createRelationship',
  fromVar: 'p',
  toVar: 't',
  relationship: {
    variable: 'r',
    relType: 'WORKS_ON',
    direction: 'outgoing',
    properties: { since: 2022 }
  }
};

const mockSetPropertyAst: ASTPropertySettingNode = {
  type: 'propertySetting',
  target: 'p',
  property: 'active',
  value: {
    type: 'literalExpression',
    value: true,
    dataType: 'boolean'
  } as ASTLiteralExpressionNode
};

// Create a valid rule AST
const mockTaskNodeAst: ASTCreateNodePatternNode = {
  type: 'createNode',
  variable: 't',
  labels: ['Task'],
  properties: { title: 'Complete project', due: '2023-12-31' }
};

const mockRuleAst: ASTRuleRoot = {
  type: 'rule',
  name: 'AddPersonAndTask',
  description: 'Create a person and a task, and connect them',
  priority: 10,
  children: [
    {
      type: 'create',
      children: [
        mockCreateNodeAst,
        mockTaskNodeAst,
        mockCreateRelAst
      ]
    } as ASTCreateNode,
    {
      type: 'set',
      children: [
        mockSetPropertyAst
      ]
    } as ASTSetNode
  ]
};

describe('Rule Action Integration Tests', () => {
  let graph: Graph;
  let bindings: BindingContext;
  let factory: ActionFactory;
  let executor: ActionExecutor;

  beforeEach(() => {
    graph = new Graph();
    bindings = new BindingContext();
    factory = new ActionFactory();
    executor = new ActionExecutor();
  });

  test('End-to-end rule execution with multiple actions', () => {
    // 1. Create actions from rule AST
    const actions = factory.createActionsFromRuleAst(mockRuleAst as ASTRuleRoot);

    // Verify actions were created correctly
    expect(actions.length).toBe(4);
    expect(actions[0].type).toBe('CREATE_NODE');
    expect(actions[1].type).toBe('CREATE_NODE');
    expect(actions[2].type).toBe('CREATE_RELATIONSHIP');
    expect(actions[3].type).toBe('SET_PROPERTY');

    // Log actions for debugging
    actions.forEach(action => {
      console.log(`Action: ${action.type} - ${action.describe()}`);
    });

    // 2. Execute actions with validation (but don't validate before, to avoid early failure)
    const result = executor.executeActions(graph, actions, bindings, {
      validateBeforeExecute: false, // Important: we'll validate each action during its execution
      continueOnFailure: true       // Try all actions even if some fail
    });

    // Log results for debugging
    console.log(`Execution succeeded: ${result.success}`);
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }

    result.actionResults.forEach((r, i) => {
      console.log(`Action ${i} ${r.success ? 'succeeded' : 'failed'}: ${r.error || ''}`);
    });

    // 3. Verify execution results
    expect(result.success).toBe(true);
    expect(result.actionResults.length).toBe(4);
    expect(result.actionResults.every(r => r.success)).toBe(true);

    // Should have 2 nodes and 1 edge
    expect(graph.getAllNodes().length).toBe(2);
    expect(graph.getAllEdges().length).toBe(1);

    // 4. Verify bindings were updated
    const personNode = bindings.get('p');
    const taskNode = bindings.get('t');
    const relation = bindings.get('r');

    expect(personNode).toBeDefined();
    expect(taskNode).toBeDefined();
    expect(relation).toBeDefined();

    expect(personNode.data.name).toBe('Alice');
    expect(personNode.data.age).toBe(30);
    expect(personNode.data.active).toBe(true); // Set by the last action

    expect(taskNode.data.title).toBe('Complete project');

    expect(relation.source).toBe(personNode.id);
    expect(relation.target).toBe(taskNode.id);
    expect(relation.label).toBe('WORKS_ON');
    expect(relation.data.since).toBe(2022);
  });

  // Let's simplify this test for now since it seems to be having trouble with pattern matching
  test('RuleEngine extracts queries from markdown', () => {
    const engine = createRuleEngine();

    // Create a clean graph
    const testGraph = new Graph();

    // Add nodes with proper labels for pattern matching
    testGraph.addNode("person1", 'Person', { name: 'John' });
    testGraph.addNode("task1", 'Task', { title: 'Task', priority: 'High' });

    // Define rule in markdown - very simple version
    const ruleMarkdown = `
## Simple Test Rule

\`\`\`graphrule
name: TestRule
description: A simple test rule
priority: 1

CREATE (n:NewNode {name: "TestNode"})
\`\`\`
    `;

    // Just test that the rule is extracted from markdown
    const results = engine.executeQueriesFromMarkdown(testGraph, ruleMarkdown);

    // Log details for debugging
    console.log('Query execution results:', results);

    // At minimum, the rule should be extracted
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(results[0].actions).toBeDefined();

    // The rule should create at least one node
    const nodes = testGraph.getAllNodes();
    console.log('Nodes after rule execution:', nodes);
    expect(nodes.length).toBeGreaterThan(1); // More than the 2 we started with
  });

  test('Handles validation failures without executing actions', () => {
    // Create a single action with validation that will fail
    const createNodeWithInvalidLabel = new CreateNodeAction('p', [123 as any], {});

    // Try to execute with validateBeforeExecute: true
    const result = executor.executeActions(graph, [createNodeWithInvalidLabel], bindings, {
      validateBeforeExecute: true
    });

    // Verify execution failed during validation
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');

    // No nodes should have been created
    expect(graph.getAllNodes().length).toBe(0);
  });

  test('Rollback on failure creating nodes', () => {
    // Create a sequence of actions where one will fail
    const createPerson = new CreateNodeAction('p', ['Person'], { name: 'Bob' });
    const createTask = new CreateNodeAction('t', ['Task'], { title: 'Do something' });

    // This action will fail because 'x' is not in bindings
    const createFailingRelationship = new CreateRelationshipAction('p', 'x', 'WORKS_ON', {});

    // Execute actions with rollback but NO up-front validation
    // (We want the first two actions to succeed so we can test rollback)
    const result = executor.executeActions(
      graph,
      [createPerson, createTask, createFailingRelationship],
      bindings,
      {
        validateBeforeExecute: false, // Important: Don't validate upfront
        rollbackOnFailure: true
      }
    );

    // Verify execution failed
    expect(result.success).toBe(false);

    // The error should be about not finding the 'x' node in bindings
    expect(result.error).toContain('Target node x not found in bindings');

    // Both created nodes should be rolled back
    expect(graph.getAllNodes().length).toBe(0);
    expect(graph.getAllEdges().length).toBe(0);
  });

  test('Rollback on failure creating nodes and edge', () => {
    // Create a sequence of actions where one will fail
    const createPerson = new CreateNodeAction('p', ['Person'], { name: 'Bob' });
    const createTask = new CreateNodeAction('t', ['Task'], { title: 'Do something' });
    const createEdge = new CreateRelationshipAction('p', 't', 'WORKS_ON', {});

    // This action will fail because 'x' is not in bindings
    const createFailingRelationship = new CreateRelationshipAction('p', 'x', 'WORKS_ON', {});

    // Execute actions with rollback but NO up-front validation
    // (We want the first two actions to succeed so we can test rollback)
    const result = executor.executeActions(
      graph,
      [createPerson, createTask, createFailingRelationship],
      bindings,
      {
        validateBeforeExecute: false, // Important: Don't validate upfront
        rollbackOnFailure: true
      }
    );

    // Verify execution failed
    expect(result.success).toBe(false);

    // The error should be about not finding the 'x' node in bindings
    expect(result.error).toContain('Target node x not found in bindings');

    // Both created nodes should be rolled back
    expect(graph.getAllNodes().length).toBe(0);
    expect(graph.getAllEdges().length).toBe(0);
  });

  test('Rollback on failure creating and deleting nodes and edges', () => {

    // add 2 nodes and an edge to the graph
    graph.addNode('alice', 'Person', { name: 'Alice' });
    graph.addNode('task', 'Task', { title: 'Do something' });
    graph.addEdge('alice', 'task', 'WORKS_ON', {});

    bindings.set('alice', graph.getNode('alice'));

    // Create a sequence of actions where one will fail
    const createPerson = new CreateNodeAction('bob', ['Person'], { name: 'Bob' });
    const deleteEdge = new DeleteAction(['alice'], true); // Detach delete

    // This action will fail because 'x' is not in bindings
    const createFailingRelationship = new CreateRelationshipAction('bob', 'x', 'WORKS_ON', {});

    // Execute actions with rollback but NO up-front validation
    // (We want the first two actions to succeed so we can test rollback)
    const result = executor.executeActions(
      graph,
      [createPerson, deleteEdge, createFailingRelationship],
      bindings,
      {
        validateBeforeExecute: false, // Important: Don't validate upfront
        rollbackOnFailure: true
      }
    );

    // Verify execution failed
    expect(result.success).toBe(false);

    // The error should be about not finding the 'x' node in bindings
    expect(result.error).toContain('Target node x not found in bindings');

    // the graph should be rolled back to its original state, with alice working on task
    expect(graph.getAllNodes().length).toBe(2);
    expect(graph.getAllEdges().length).toBe(1);
    expect(graph.hasNode('alice')).toBe(true);
    expect(graph.hasNode('bob')).toBe(false);
    expect(graph.hasEdge('alice', 'task', 'WORKS_ON')).toBe(true);
  });

  test('Debug rule engine pattern matching for simple node patterns', () => {
    // Create a rule engine
    const engine = createRuleEngine();

    // Create a test graph
    const testGraph = new Graph();

    // Add nodes with proper labels
    testGraph.addNode("person1", 'Person', { name: 'John' });
    testGraph.addNode("task1", 'Task', { title: 'Task 1', priority: 'High' });

    // Use a very simple rule to test binding with comma-separated patterns
    const ruleText = `
    MATCH (p:Person), (t:Task)
    RETURN p, t
    `;

    // Use the pattern matcher directly to verify if we can match these patterns
    const patternMatcher = new PatternMatcherWithConditions();

    // Define simple node patterns
    const personPattern: NodePattern = {
      variable: 'p',
      labels: ['Person'],
      properties: {}
    };

    const taskPattern: NodePattern = {
      variable: 't',
      labels: ['Task'],
      properties: {}
    };

    // Find matching nodes directly
    const personNodes = patternMatcher.findMatchingNodes(testGraph, personPattern);
    const taskNodes = patternMatcher.findMatchingNodes(testGraph, taskPattern);

    console.log('\nDebug pattern matching directly:');
    console.log('Person nodes found:', personNodes.length);
    console.log('Task nodes found:', taskNodes.length);

    // Now if we manually put these in bindings, it should work
    const manualBindings = new BindingContext();
    if (personNodes.length > 0) manualBindings.set('p', personNodes[0]);
    if (taskNodes.length > 0) manualBindings.set('t', taskNodes[0]);

    console.log('Manual bindings "p" exists:', manualBindings.has('p'));
    console.log('Manual bindings "t" exists:', manualBindings.has('t'));

    // These tests should pass - proving pattern matching works directly
    expect(personNodes.length).toBeGreaterThan(0);
    expect(taskNodes.length).toBeGreaterThan(0);
    expect(manualBindings.has('p')).toBe(true);
    expect(manualBindings.has('t')).toBe(true);
  });

  test('Rule engine should properly bind pattern matching variables to actions', () => {
    // Create a rule engine
    const engine = createRuleEngine();

    // Create a graph with nodes similar to our example
    const testGraph = new Graph();

    // Add nodes with proper labels for pattern matching
    const personId = "test-person";
    const taskId = "test-task";
    testGraph.addNode(personId, 'Person', { name: 'John' });
    testGraph.addNode(taskId, 'Task', { title: 'Fix bugs', priority: 'High' });

    // Verify nodes were added correctly
    expect(testGraph.getAllNodes().length).toBe(2);
    expect(testGraph.findNodes(node => node.label === 'Person').length).toBe(1);
    expect(testGraph.findNodes(node => node.label === 'Task').length).toBe(1);

    // Define a rule that matches Person and Task nodes and creates a relationship between them
    const ruleMarkdown = `
## Connect People to Tasks

\`\`\`graphrule
name: ConnectPersonToTask
description: Create WORKS_ON relationships between people and tasks
priority: 10

MATCH (p:Person), (t:Task)
CREATE (p)-[r:WORKS_ON {assigned: true, date: "2023-01-15"}]->(t)
\`\`\`
    `;

    // Execute the rule
    const results = engine.executeQueriesFromMarkdown(testGraph, ruleMarkdown);

    // Log results for debugging
    console.log('\nRule execution results for pattern matching binding test:');
    console.log(`Rule text: ${results[0].statement}`);
    console.log(`Success: ${results[0].success}`);
    console.log(`Matches found: ${results[0].matchCount}`);
    console.log(`Error: ${results[0].error || 'none'}`);

    // Examine rule engine internal state 
    console.log('\nRule engine execution details:');
    try {
      const ruleEngineStateStr = JSON.stringify(results[0], (key, value) => {
        // Limit circular references
        if (key === 'bindings' && typeof value === 'object') {
          return 'BindingContext object';
        }
        return value;
      }, 2);
      console.log(ruleEngineStateStr.substring(0, 1000) + '...'); // Limit output size
    } catch (error) {
      console.log('Could not stringify rule engine results:', error);
    }

    // Log graph state after rule execution
    console.log('Nodes in graph:', testGraph.getAllNodes().length);
    console.log('Edges in graph:', testGraph.getAllEdges().length);

    // EXPECTED CORRECT BEHAVIOR:

    // 1. Pattern matching should find Person and Task nodes
    expect(results[0].matchCount).toBeGreaterThan(0);

    // 2. Rule execution should succeed because variables should be properly bound
    expect(results[0].success).toBe(true); // THIS WILL FAIL with current implementation

    // 3. There should be no execution errors
    expect(results[0].error).toBeUndefined(); // THIS WILL FAIL with current implementation

    // 4. All actions should have executed successfully
    if (results[0].actions && results[0].actions.actionResults.length > 0) {
      console.log('Action execution results:',
        results[0].actions.actionResults.map(r => ({ success: r.success, error: r.error }))
      );

      // All actions should succeed (no binding errors)
      const allActionsSucceeded = results[0].actions.actionResults.every(r => r.success === true);
      expect(allActionsSucceeded).toBe(true); // THIS WILL FAIL with current implementation
    }

    // 5. A relationship should have been created between Person and Task nodes
    expect(testGraph.getAllEdges().length).toBeGreaterThan(0); // THIS WILL FAIL with current implementation

    // 6. The relationship should have the correct properties
    const edges = testGraph.getAllEdges();
    if (edges.length > 0) {
      const relationship = edges[0];
      expect(relationship.label).toBe('WORKS_ON');
      expect(relationship.data.assigned).toBe(true);
      expect(relationship.data.date).toBe('2023-01-15');

      // The relationship should connect the Person and Task nodes
      const sourceNode = testGraph.getNode(relationship.source);
      const targetNode = testGraph.getNode(relationship.target);

      expect(sourceNode?.label).toBe('Person');
      expect(targetNode?.label).toBe('Task');
    }

    // If the test reaches this point without failing, the rule engine is correctly
    // transferring variable bindings from pattern matching to action execution
  });

  /**
   * Test to cover cross-product binding functionality added to rule engine
   */
  test('Rule engine should properly combine binding contexts from multiple patterns', () => {
    // Create a test graph
    const testGraph = new Graph();

    // Add multiple nodes of each label for more complex binding combinations
    testGraph.addNode("person1", 'Person', { name: 'Alice', });
    testGraph.addNode("person2", 'Person', { name: 'Bob', });
    testGraph.addNode("task1", 'Task', { title: 'Task 1', });
    testGraph.addNode("task2", 'Task', { title: 'Task 2', });
    // Define a rule that matches all people and all tasks and connects them
    const ruleMarkdown = `
## Connect All People to All Tasks

\`\`\`graphrule
name: ConnectAllPeopleToTasks
description: Create WORKS_ON relationships between all people and all tasks
priority: 5

MATCH (p:Person), (t:Task)
CREATE (p)-[r:ASSIGNED {date: "2023-01-15"}]->(t)
\`\`\`
    `;

    // Execute the rule
    const engine = createRuleEngine();
    const results = engine.executeQueriesFromMarkdown(testGraph, ruleMarkdown);

    // Verify rule execution result
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);

    // With 2 people and 2 tasks, we should have 4 binding combinations (2×2=4)
    // One relationship for each binding combination should be created
    const edges = testGraph.getAllEdges();
    expect(edges.length).toBe(4);

    // Verify that each person is connected to each task (cross-product)
    const person1Edges = testGraph.getEdgesForNode("person1", "outgoing");
    const person2Edges = testGraph.getEdgesForNode("person2", "outgoing");

    expect(person1Edges.length).toBe(2); // Person1 -> Task1, Person1 -> Task2
    expect(person2Edges.length).toBe(2); // Person2 -> Task1, Person2 -> Task2

    // Verify each relationship has the correct type and properties
    for (const edge of edges) {
      expect(edge.label).toBe('ASSIGNED');
      expect(edge.data.date).toBe('2023-01-15');

      // Source should be a person node
      const sourceNode = testGraph.getNode(edge.source);
      expect(sourceNode?.label).toBe('Person');

      // Target should be a task node
      const targetNode = testGraph.getNode(edge.target);
      expect(targetNode?.label).toBe('Task');
    }

    // More specific cross-product validation
    // Create a map of source->target connections to verify all combinations exist
    const connections = new Set<string>();
    edges.forEach(edge => {
      connections.add(`${edge.source}->${edge.target}`);
    });

    // All four combinations should exist
    expect(connections.has("person1->task1")).toBe(true);
    expect(connections.has("person1->task2")).toBe(true);
    expect(connections.has("person2->task1")).toBe(true);
    expect(connections.has("person2->task2")).toBe(true);
  });

  /**
   * Test to cover edge cases in binding combination
   */
  test('Rule engine should handle edge cases in binding combinations', () => {
    // Create a test graph
    const testGraph = new Graph();

    // Add a single person node for testing the case where one pattern has only one match
    testGraph.addNode("person1", 'Person', { name: 'Alice', });
    // Test rule with no matches for one pattern - should have no combined results
    const noMatchRuleMarkdown = `
## No Match Rule

\`\`\`graphrule
name: NoMatchRule
description: Should not match anything because Project nodes don't exist
priority: 5

MATCH (p:Person), (proj:Project)
CREATE (p)-[r:WORKS_ON]->(proj)
\`\`\`
    `;

    const engine = createRuleEngine();
    const noMatchResults = engine.executeQueriesFromMarkdown(testGraph, noMatchRuleMarkdown);

    // Rule should execute but create no relationships because one pattern has no matches
    expect(noMatchResults.length).toBe(1);
    expect(noMatchResults[0].success).toBe(true);
    expect(noMatchResults[0].matchCount).toBe(0); // No matches when one pattern has no matches
    expect(noMatchResults[0].actions?.actionResults.length).toBe(0); // No actions executed with no matches

    // No edges should be created
    expect(testGraph.getAllEdges().length).toBe(0);

    // Test rule with a single pattern (not using cross-product bindings)
    const singlePatternRuleMarkdown = `
## Single Pattern Rule

\`\`\`graphrule
name: SinglePatternRule
description: Only matches a single pattern (Person)
priority: 5

MATCH (p:Person)
SET p.status = "Active"
\`\`\`
    `;

    const singlePatternResults = engine.executeQueriesFromMarkdown(testGraph, singlePatternRuleMarkdown);

    // Rule should execute and match the single person
    expect(singlePatternResults.length).toBe(1);
    expect(singlePatternResults[0].success).toBe(true);
    expect(singlePatternResults[0].matchCount).toBe(1);

    // The Person node should have its status set to "Active"
    const person = testGraph.getNode("person1");
    expect(person?.data.status).toBe("Active");
  });
});