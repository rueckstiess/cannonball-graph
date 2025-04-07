import { Graph, Node, Edge } from '@/graph';
import { BindingContext } from '@/lang/condition-evaluator';
import { DeleteAction } from '@/query/rule-action';

describe('DeleteAction', () => {
  let graph: Graph;
  let bindings: BindingContext;

  beforeEach(() => {
    graph = new Graph();
    bindings = new BindingContext();
  });

  test('should initialize DeleteAction correctly', () => {
    const action = new DeleteAction(['n'], true);
    expect(action.variableNames).toEqual(['n']);
    expect(action.detach).toBe(true);
    expect(action.type).toBe('DELETE');
  });

  test('should validate variables correctly', () => {
    graph.addNode('node1', 'Person', { name: 'Alice' });
    const node = graph.getNode('node1');
    bindings.set('n', node);

    const action = new DeleteAction(['n'], false);
    const validation = action.validate(graph, bindings);

    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();

    const invalidAction = new DeleteAction(['x'], false);
    const invalidValidation = invalidAction.validate(graph, bindings);

    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.error).toContain('Variable \'x\' to delete not found in bindings');
  });

  test('should delete a node and its relationships with DETACH', () => {
    graph.addNode('node1', 'Person', { name: 'Alice' });
    graph.addNode('node2', 'Task', { title: 'Task 1' });
    graph.addEdge('node1', 'node2', 'ASSIGNED_TO', {});

    const node = graph.getNode('node1');
    bindings.set('n', node);

    const action = new DeleteAction(['n'], true);
    const result = action.execute(graph, bindings);

    expect(result.success).toBe(true);
    expect(result.affectedNodes?.length).toBe(1);
    expect(result.affectedEdges?.length).toBe(1);
    expect(graph.hasNode('node1')).toBe(false);
    expect(graph.hasEdge('node1', 'node2', 'ASSIGNED_TO')).toBe(false);
  });

  test('should fail to delete a node with relationships without DETACH', () => {
    graph.addNode('node1', 'Person', { name: 'Alice' });
    graph.addNode('node2', 'Task', { title: 'Task 1' });
    graph.addEdge('node1', 'node2', 'ASSIGNED_TO', {});

    const node = graph.getNode('node1');
    bindings.set('n', node);

    const action = new DeleteAction(['n'], false);
    const result = action.execute(graph, bindings);

    expect(result.success).toBe(false);
    expect(result.error).toContain('still has relationships');
    expect(graph.hasNode('node1')).toBe(true);
  });

  test('should delete an edge', () => {
    graph.addNode('node1', 'Person', { name: 'Alice' });
    graph.addNode('node2', 'Task', { title: 'Task 1' });
    graph.addEdge('node1', 'node2', 'ASSIGNED_TO', {});

    const edge = graph.getEdge('node1', 'node2', 'ASSIGNED_TO');
    bindings.set('r', edge);

    const action = new DeleteAction(['r'], false);
    const result = action.execute(graph, bindings);

    expect(result.success).toBe(true);
    expect(result.affectedEdges?.length).toBe(1);
    expect(graph.hasEdge('node1', 'node2', 'ASSIGNED_TO')).toBe(false);
  });

  test('should describe the action correctly', () => {
    const actionDetach = new DeleteAction(['n'], true);
    expect(actionDetach.describe()).toBe('DETACH DELETE n');

    const actionNoDetach = new DeleteAction(['n'], false);
    expect(actionNoDetach.describe()).toBe('DELETE n');
  });
});
