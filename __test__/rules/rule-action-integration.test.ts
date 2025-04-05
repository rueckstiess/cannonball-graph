import { Graph, Node } from '@/graph';
import { BindingContext } from '@/lang/condition-evaluator';
import { ASTRuleRoot } from '@/lang/ast-transformer';
import {
  CreateNodeAction,
  CreateRelationshipAction,
  SetPropertyAction,
  ActionExecutor,
  ActionFactory,
  RuleAction,
  createRuleEngine
} from '@/rules';

// Mock AST for testing
const mockCreateNodeAst = {
  type: 'createNode' as const,
  variable: 'p',
  labels: ['Person'],
  properties: { name: 'Alice', age: 30 }
};

const mockCreateRelAst = {
  type: 'createRelationship' as const,
  fromVar: 'p',
  toVar: 't',
  relationship: {
    variable: 'r',
    relType: 'WORKS_ON',
    properties: { since: 2022 }
  }
};

const mockSetPropertyAst = {
  type: 'propertySetting' as const,
  target: 'p',
  property: 'active',
  value: {
    type: 'literalExpression',
    value: true,
    dataType: 'boolean'
  }
};

// Mock rule AST with multiple actions
const mockRuleAst: Partial<ASTRuleRoot> = {
  type: 'rule',
  name: 'AddPersonAndTask',
  description: 'Create a person and a task, and connect them',
  priority: 10,
  children: [
    {
      type: 'create',
      children: [
        mockCreateNodeAst,
        {
          type: 'createNode' as const,
          variable: 't',
          labels: ['Task'],
          properties: { title: 'Complete project', due: '2023-12-31' }
        },
        mockCreateRelAst
      ]
    },
    {
      type: 'set',
      children: [
        mockSetPropertyAst
      ]
    }
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
    
    // 2. Execute actions
    const result = executor.executeActions(graph, actions, bindings);
    
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
  
  test('RuleEngine executes cypher statements from Markdown', () => {
    const engine = createRuleEngine();
    
    // Set up initial graph
    graph.addNode("person1", { name: 'John', labels: ['Person'] });
    graph.addNode("person2", { name: 'Jane', labels: ['Person'] });
    graph.addNode("task1", { title: 'Important Task', priority: 'Medium', labels: ['Task'] });
    
    // Define rule in markdown
    const ruleMarkdown = `
## Connect Person to Task

\`\`\`graphrule
name: ConnectFirstPerson
description: Connect the first person to the task
priority: 10

MATCH (p:Person), (t:Task)
WHERE p.name = "John" 
CREATE (p)-[r:ASSIGNED_TO {date: "2023-06-15"}]->(t)
\`\`\`
    `;
    
    // Execute the rule
    const results = engine.executeRulesFromMarkdown(graph, ruleMarkdown);
    
    // Verify results
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(results[0].matchCount).toBe(1); // 1 match found (John + task)
    
    // Check if relationship was created
    const edges = graph.findEdges(edge => edge.label === 'ASSIGNED_TO');
    expect(edges.length).toBe(1);
    expect(edges[0].source).toBe("person1");
    expect(edges[0].target).toBe("task1");
    expect(edges[0].data.date).toBe('2023-06-15');
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
  
  test('Rollback on failure', () => {
    // Create a sequence of actions where one will fail
    const createPerson = new CreateNodeAction('p', ['Person'], { name: 'Bob' });
    const createTask = new CreateNodeAction('t', ['Task'], { title: 'Do something' });
    
    // This action will fail because 'x' is not in bindings
    const createFailingRelationship = new CreateRelationshipAction('p', 'x', 'WORKS_ON', {});
    
    // Execute actions with rollback
    const result = executor.executeActions(
      graph, 
      [createPerson, createTask, createFailingRelationship],
      bindings,
      { rollbackOnFailure: true }
    );
    
    // Verify execution failed
    expect(result.success).toBe(false);
    expect(result.error).toContain('Target node x not found');
    
    // Both created nodes should be rolled back
    expect(graph.getAllNodes().length).toBe(0);
    expect(graph.getAllEdges().length).toBe(0);
  });
  
  test('Continue on failure', () => {
    // Create a sequence of actions where one will fail but others can continue
    const createPerson = new CreateNodeAction('p', ['Person'], { name: 'Charlie' });
    
    // This action will fail
    const createFailingNode = new CreateNodeAction('p', ['Task'], {}); // Duplicate variable
    
    // This action can still succeed
    const createAnotherNode = new CreateNodeAction('t', ['Task'], { title: 'Important task' });
    
    // Execute actions with continueOnFailure: true
    const result = executor.executeActions(
      graph,
      [createPerson, createFailingNode, createAnotherNode],
      bindings,
      { continueOnFailure: true }
    );
    
    // Overall execution should fail
    expect(result.success).toBe(false);
    
    // But two nodes should be created (the first and third)
    expect(graph.getAllNodes().length).toBe(2);
    expect(bindings.has('p')).toBe(true);
    expect(bindings.has('t')).toBe(true);
    
    // Should have 3 action results (one success, one failure, one success)
    expect(result.actionResults.length).toBe(3);
    expect(result.actionResults[0].success).toBe(true);
    expect(result.actionResults[1].success).toBe(false);
    expect(result.actionResults[2].success).toBe(true);
  });
});