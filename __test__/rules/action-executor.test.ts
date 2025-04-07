import { Graph } from '@/graph';
import { ActionExecutor, CreateNodeAction, SetPropertyAction, DeleteAction } from '@/rules';
import { BindingContext } from '@/lang/condition-evaluator';

describe('ActionExecutor', () => {
  let graph: Graph;
  let executor: ActionExecutor;
  let bindings: BindingContext;

  beforeEach(() => {
    graph = new Graph();
    executor = new ActionExecutor();
    bindings = new BindingContext();
  });

  test('should execute DeleteAction and delete nodes and edges', () => {
    // Setup graph
    graph.addNode('node1', 'Person', { name: 'Alice' });
    graph.addNode('node2', 'Task', { title: 'Task 1' });
    graph.addEdge('node1', 'node2', 'ASSIGNED_TO', {});

    const node = graph.getNode('node1');
    bindings.set('n', node);

    const deleteAction = new DeleteAction(['n'], true);

    const result = executor.executeActions(graph, [deleteAction], bindings, {
      rollbackOnFailure: false,
      validateBeforeExecute: true
    });

    expect(result.success).toBe(true);
    expect(result.actionResults.length).toBe(1);
    expect(result.actionResults[0].success).toBe(true);
    expect(graph.hasNode('node1')).toBe(false);
    expect(graph.hasEdge('node1', 'node2', 'ASSIGNED_TO')).toBe(false);
  });

  test('should rollback DeleteAction on failure', () => {
    // Setup graph
    graph.addNode('node1', 'Person', { name: 'Alice' });
    graph.addNode('node2', 'Task', { title: 'Task 1' });
    graph.addEdge('node1', 'node2', 'ASSIGNED_TO', {});

    const node = graph.getNode('node1');
    bindings.set('n', node);

    const deleteAction = new DeleteAction(['n'], true);
    const invalidAction = new CreateNodeAction('n', ['Person'], { name: 'Duplicate' }); // Will fail due to duplicate variable

    const result = executor.executeActions(graph, [deleteAction, invalidAction], bindings, {
      rollbackOnFailure: true,
      validateBeforeExecute: false // Disable validation
    });

    expect(result.success).toBe(false);
    expect(result.actionResults.length).toBe(2);
    expect(result.actionResults[0].success).toBe(true); // DeleteAction succeeded
    expect(result.actionResults[1].success).toBe(false); // CreateNodeAction failed
    expect(graph.hasNode('node1')).toBe(true); // Node should be restored
    expect(graph.hasEdge('node1', 'node2', 'ASSIGNED_TO')).toBe(true); // Edge should be restored
  });

  test('should execute actions in the correct order', () => {
    // Setup graph
    graph.addNode('alice', 'Person', { name: 'Alice' });
    const alice = graph.getNode('alice');
    bindings.set('n', alice);

    const createAction = new CreateNodeAction('task', ['Task'], { title: 'Task 1' });
    const setAction = new SetPropertyAction('n', 'age', 30);
    const deleteAction = new DeleteAction(['n'], true);

    const result = executor.executeActions(graph, [createAction, setAction, deleteAction], bindings, {
      rollbackOnFailure: false,
      validateBeforeExecute: true
    });

    expect(result.success).toBe(true);
    expect(result.actionResults.length).toBe(3);
    expect(result.actionResults[0].success).toBe(true); // CreateNodeAction succeeded
    expect(result.actionResults[1].success).toBe(true); // SetPropertyAction succeeded
    expect(result.actionResults[2].success).toBe(true); // DeleteAction succeeded
    expect(graph.hasNode('alice')).toBe(false); // Node should be deleted

    // get node
    const nodes = graph.getAllNodes();
    expect(nodes.length).toBe(1); // Only one node should remain
    expect(nodes[0].label).toBe('Task'); // Remaining node should be a Task
    expect(nodes[0].data.title).toBe('Task 1'); // Task title should be correct
  });
});
