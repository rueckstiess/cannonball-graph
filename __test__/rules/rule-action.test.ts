import { Graph, Node } from '@/graph';
import { BindingContext } from '@/lang/condition-evaluator';
import {
  RuleAction,
  CreateNodeAction,
  CreateRelationshipAction,
  SetPropertyAction,
  ActionExecutor,
  ActionFactory
} from '@/rules';

describe('CreateNodeAction', () => {
  let graph: Graph;
  let bindings: BindingContext;
  
  beforeEach(() => {
    graph = new Graph();
    bindings = new BindingContext();
  });
  
  test('should create a node and add it to the graph', () => {
    const action = new CreateNodeAction('n', ['Person'], { name: 'Alice', age: 30 });
    
    const result = action.execute(graph, bindings);
    
    expect(result.success).toBe(true);
    expect(result.affectedNodes?.length).toBe(1);
    expect(graph.getAllNodes().length).toBe(1);
    
    // Verify the node has correct data
    const node = bindings.get('n');
    expect(node).toBeDefined();
    expect(node.data.name).toBe('Alice');
    expect(node.data.age).toBe(30);
    expect(node.data.labels).toContain('Person');
    
    // Verify the node was bound to the variable
    expect(bindings.get('n')).toBe(node);
  });
  
  test('should validate that the variable does not already exist', () => {
    // Create a node with ID "existing"
    graph.addNode("existing", { name: 'Bob' });
    const existingNode = graph.getNode("existing");
    bindings.set('n', existingNode);
    
    const action = new CreateNodeAction('n', ['Person'], { name: 'Alice' });
    
    const validation = action.validate(graph, bindings);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('already exists');
    
    const result = action.execute(graph, bindings);
    expect(result.success).toBe(false);
  });
});

describe('CreateRelationshipAction', () => {
  let graph: Graph;
  let bindings: BindingContext;
  let sourceNode: Node;
  let targetNode: Node;
  
  beforeEach(() => {
    graph = new Graph();
    bindings = new BindingContext();
    
    // Create two nodes and add them to bindings
    graph.addNode("person1", { name: 'Alice', labels: ['Person'] });
    graph.addNode("task1", { title: 'Task 1', labels: ['Task'] });
    
    sourceNode = graph.getNode("person1")!;
    targetNode = graph.getNode("task1")!;
    
    bindings.set('p', sourceNode);
    bindings.set('t', targetNode);
  });
  
  test('should create a relationship between nodes', () => {
    const action = new CreateRelationshipAction('p', 't', 'WORKS_ON', { since: 2022 });
    
    const result = action.execute(graph, bindings);
    
    expect(result.success).toBe(true);
    expect(result.affectedEdges?.length).toBe(1);
    
    // Verify the relationship exists
    const edge = graph.getEdge(sourceNode.id, targetNode.id, 'WORKS_ON');
    expect(edge).toBeDefined();
    expect(edge?.data.since).toBe(2022);
  });
  
  test('should validate that source and target nodes exist', () => {
    // Try with missing source node
    const missingSourceAction = new CreateRelationshipAction('missing', 't', 'WORKS_ON', {});
    
    const validation = missingSourceAction.validate(graph, bindings);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Source node');
    
    const result = missingSourceAction.execute(graph, bindings);
    expect(result.success).toBe(false);
  });
});

describe('SetPropertyAction', () => {
  let graph: Graph;
  let bindings: BindingContext;
  
  beforeEach(() => {
    graph = new Graph();
    bindings = new BindingContext();
    
    // Create a node and add it to bindings
    graph.addNode("person1", { name: 'Alice', labels: ['Person'] });
    bindings.set('n', graph.getNode("person1"));
  });
  
  test('should update a property on a node', () => {
    const action = new SetPropertyAction('n', 'age', 30);
    
    const result = action.execute(graph, bindings);
    
    expect(result.success).toBe(true);
    expect(result.affectedNodes?.length).toBe(1);
    
    // Verify the property was set
    const updatedNode = bindings.get('n');
    expect(updatedNode.data.age).toBe(30);
    expect(updatedNode.data.name).toBe('Alice'); // Original property still exists
  });
  
  test('should validate that target exists', () => {
    const action = new SetPropertyAction('missing', 'age', 30);
    
    const validation = action.validate(graph, bindings);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Target');
    
    const result = action.execute(graph, bindings);
    expect(result.success).toBe(false);
  });
  
  test('should work with relationship properties too', () => {
    // Create nodes and relationship
    graph.addNode("person2", { name: 'Bob', labels: ['Person'] });
    graph.addNode("task1", { title: 'Task 1', labels: ['Task'] });
    
    graph.addEdge("person2", "task1", 'WORKS_ON', { priority: 'Low' });
    
    const relationship = graph.getEdge("person2", "task1", 'WORKS_ON');
    bindings.set('r', relationship);
    
    // Update relationship property
    const action = new SetPropertyAction('r', 'priority', 'High');
    
    const result = action.execute(graph, bindings);
    
    expect(result.success).toBe(true);
    expect(result.affectedEdges?.length).toBe(1);
    
    // Verify the property was set
    const updatedRel = bindings.get('r');
    expect(updatedRel.data.priority).toBe('High');
  });
});

describe('ActionExecutor', () => {
  let graph: Graph;
  let bindings: BindingContext;
  let executor: ActionExecutor;
  
  beforeEach(() => {
    graph = new Graph();
    bindings = new BindingContext();
    executor = new ActionExecutor();
  });
  
  test('should execute multiple actions in sequence', () => {
    // Create a sequence of actions
    const actions: RuleAction[] = [
      new CreateNodeAction('p', ['Person'], { name: 'Charlie' }),
      new CreateNodeAction('t', ['Task'], { title: 'Task 1' }),
      new CreateRelationshipAction('p', 't', 'WORKS_ON', { since: 2023 })
    ];
    
    const result = executor.executeActions(graph, actions, bindings);
    
    expect(result.success).toBe(true);
    expect(result.actionResults.length).toBe(3);
    expect(result.actionResults.every(r => r.success)).toBe(true);
    
    // Verify graph state
    expect(graph.getAllNodes().length).toBe(2);
    
    // Verify bindings
    expect(bindings.has('p')).toBe(true);
    expect(bindings.has('t')).toBe(true);
    
    // Verify relationship exists
    const pNode = bindings.get('p');
    const tNode = bindings.get('t');
    expect(graph.hasEdge(pNode.id, tNode.id, 'WORKS_ON')).toBe(true);
  });
  
  test('should stop execution on failure by default', () => {
    // Create a sequence with a failing action in the middle
    const actions: RuleAction[] = [
      new CreateNodeAction('p', ['Person'], { name: 'Dave' }),
      new CreateNodeAction('p', ['Task'], { title: 'Task 1' }), // This will fail (duplicate var)
      new CreateNodeAction('t', ['Task'], { title: 'Task 2' })  // This should not execute
    ];
    
    const result = executor.executeActions(graph, actions, bindings);
    
    expect(result.success).toBe(false);
    expect(result.actionResults.length).toBe(2); // Only first two attempted
    expect(result.actionResults[0].success).toBe(true);
    expect(result.actionResults[1].success).toBe(false);
    
    // Verify only first node was created
    expect(graph.getAllNodes().length).toBe(1);
    expect(bindings.has('p')).toBe(true);
    expect(bindings.has('t')).toBe(false);
  });
  
  test('should continue execution on failure when specified', () => {
    // Create a sequence with a failing action in the middle
    const actions: RuleAction[] = [
      new CreateNodeAction('p', ['Person'], { name: 'Eve' }),
      new CreateNodeAction('p', ['Task'], { title: 'Task 1' }), // This will fail (duplicate var)
      new CreateNodeAction('t', ['Task'], { title: 'Task 3' })  // This should still execute
    ];
    
    const result = executor.executeActions(graph, actions, bindings, {
      continueOnFailure: true
    });
    
    expect(result.success).toBe(false); // Overall still fails
    expect(result.actionResults.length).toBe(3); // All actions attempted
    expect(result.actionResults[0].success).toBe(true);
    expect(result.actionResults[1].success).toBe(false);
    expect(result.actionResults[2].success).toBe(true);
    
    // Verify first and third nodes were created
    expect(graph.getAllNodes().length).toBe(2);
    expect(bindings.has('p')).toBe(true);
    expect(bindings.has('t')).toBe(true);
  });
});

describe('ActionFactory', () => {
  let factory: ActionFactory;
  
  beforeEach(() => {
    factory = new ActionFactory();
  });
  
  test('should create actions from AST nodes', () => {
    // Mock AST nodes
    const createNodeAst = {
      type: 'createNode' as const,
      variable: 'p',
      labels: ['Person'],
      properties: { name: 'Alice', age: 30 }
    };
    
    const createRelAst = {
      type: 'createRelationship' as const,
      fromVar: 'p',
      toVar: 't',
      relationship: {
        variable: 'r',
        relType: 'KNOWS',
        properties: { since: 2020 }
      }
    };
    
    const setPropertyAst = {
      type: 'propertySetting' as const,
      target: 'p',
      property: 'active',
      value: {
        type: 'literalExpression',
        value: true,
        dataType: 'boolean'
      }
    };
    
    // Create actions from AST nodes
    const nodeAction = factory.createNodeActionFromAst(createNodeAst);
    const relAction = factory.createRelationshipActionFromAst(createRelAst);
    const propAction = factory.setPropertyActionFromAst(setPropertyAst);
    
    // Verify node action
    expect(nodeAction.type).toBe('CREATE_NODE');
    expect(nodeAction.variable).toBe('p');
    expect(nodeAction.labels).toContain('Person');
    expect(nodeAction.properties.name).toBe('Alice');
    
    // Verify relationship action
    expect(relAction.type).toBe('CREATE_RELATIONSHIP');
    expect(relAction.fromVariable).toBe('p');
    expect(relAction.toVariable).toBe('t');
    expect(relAction.relType).toBe('KNOWS');
    expect(relAction.variable).toBe('r');
    
    // Verify property action
    expect(propAction.type).toBe('SET_PROPERTY');
    expect(propAction.targetVariable).toBe('p');
    expect(propAction.propertyName).toBe('active');
    expect(propAction.value).toBe(true);
  });
});