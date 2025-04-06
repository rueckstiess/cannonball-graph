import { Graph, Node, Edge, NodeId } from '@/graph'; // <-- Add NodeId
import { CreateNodeAction } from './create-node-action';
import { CreateRelationshipAction } from './create-relationship-action';
import { BindingContext } from '@/lang/condition-evaluator';
import {
  RuleAction,
  ActionExecutor as IActionExecutor,
  ActionExecutionOptions,
  ActionExecutionResult,
  ActionResult,
  DeleteAction as IDeleteAction // <-- Import DeleteAction interface
} from './rule-action';

/**
 * Default options for action execution
 */
const DEFAULT_EXECUTION_OPTIONS: ActionExecutionOptions = {
  rollbackOnFailure: true,
  validateBeforeExecute: true,
  continueOnFailure: false
};

/**
 * Implementation of the ActionExecutor interface
 */
export class ActionExecutor<NodeData = any, EdgeData = any>
  implements IActionExecutor<NodeData, EdgeData> {

  /**
   * Executes a list of actions on the graph
   * 
   * @param graph The graph to execute on
   * @param actions The actions to execute
   * @param bindings Variable bindings from pattern matching
   * @param options Execution options
   * @returns The result of the execution
   */
  executeActions(
    graph: Graph<NodeData, EdgeData>,
    actions: RuleAction<NodeData, EdgeData>[],
    bindings: BindingContext<NodeData, EdgeData>,
    options?: ActionExecutionOptions
  ): ActionExecutionResult<NodeData, EdgeData> {
    // Use default options if not provided
    const execOptions: ActionExecutionOptions = {
      ...DEFAULT_EXECUTION_OPTIONS,
      ...options
    };

    // Initial result structure
    const result: ActionExecutionResult<NodeData, EdgeData> = {
      success: true,
      actionResults: [],
      affectedNodes: [],
      affectedEdges: []
    };

    // Pre-validate all actions if required
    if (execOptions.validateBeforeExecute) {
      for (const action of actions) {
        const validation = action.validate(graph, bindings);
        if (!validation.valid) {
          return {
            ...result,
            success: false,
            error: `Validation failed: ${validation.error}`
          };
        }
      }
    }

    // Track changes for potential rollback
    const originalBindings = new Map<string, any>();
    const createdNodeIds: NodeId[] = []; // Use NodeId type
    const createdEdgeKeys: string[] = []; // Use string key source-label-target
    const modifiedNodesOriginalData = new Map<NodeId, NodeData>(); // Store original data for modified nodes
    const modifiedEdgesOriginalData = new Map<string, EdgeData>(); // Store original data for modified edges
    const deletedNodes: Node<NodeData>[] = []; // Store original deleted nodes
    const deletedEdges: Edge<EdgeData>[] = []; // Store original deleted edges

    // Keep a copy of the initial bindings for rollback
    if (execOptions.rollbackOnFailure) {
      // Collect all variable names in the bindings that have values
      const varNames = [];
      for (let i = 0; i < actions.length; i++) {
        if (actions[i].type === 'CREATE_NODE') {
          varNames.push((actions[i] as CreateNodeAction<NodeData, EdgeData>).variable);
        } else if (actions[i].type === 'CREATE_RELATIONSHIP' && (actions[i] as CreateRelationshipAction<NodeData, EdgeData>).variable) {
          varNames.push((actions[i] as CreateRelationshipAction<NodeData, EdgeData>).variable!);
        }
      }

      // Save initial state of existing bindings
      for (const name of varNames) {
        if (bindings.has(name)) {
          originalBindings.set(name, bindings.get(name));
        }
      }
    }

    // Execute each action
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      let originalNodeData: NodeData | undefined;
      let originalEdgeData: EdgeData | undefined;
      let edgeKey: string | undefined;

      // Capture original data *before* execution for SET or DELETE
      if (execOptions.rollbackOnFailure) {
        if (action.type === 'SET_PROPERTY') {
          // ... (logic to get original data for SET - needs refinement if not already present) ...
        } else if (action.type === 'DELETE') {
          const deleteAction = action as IDeleteAction<NodeData, EdgeData>;
          for (const varName of deleteAction.variableNames) {
            const item = bindings.get(varName);
            if (item) {
              if ('id' in item && !('source' in item)) { // It's a Node
                const node = item as Node<NodeData>;
                if (!deletedNodes.some(n => n.id === node.id)) {
                  deletedNodes.push({ ...node, data: { ...node.data } }); // Deep copy
                }
              } else if ('source' in item && 'target' in item) { // It's an Edge
                const edge = item as Edge<EdgeData>;
                edgeKey = `${edge.source}-${edge.label}-${edge.target}`;
                if (!deletedEdges.some(e => `${e.source}-${e.label}-${e.target}` === edgeKey)) {
                  deletedEdges.push({ ...edge, data: { ...edge.data } }); // Deep copy
                }
              }
            }
          }
        }
      }

      try {
        // Log action for debugging
        console.debug(`Executing action: ${action.describe()}`);

        // Execute the action
        const actionResult = action.execute(graph, bindings);
        result.actionResults.push(actionResult);

        if (!actionResult.success) {
          // Action failed
          result.success = false;
          result.error = actionResult.error;

          // Stop execution if continueOnFailure is false
          if (!execOptions.continueOnFailure) {
            break;
          }
        } else {
          // Track affected nodes and edges
          if (actionResult.affectedNodes) {
            result.affectedNodes.push(...actionResult.affectedNodes);

            // Track created or modified nodes for potential rollback
            actionResult.affectedNodes.forEach(node => {
              if (action.type === 'CREATE_NODE') {
                if (!createdNodeIds.includes(node.id)) createdNodeIds.push(node.id);
              }
              // Note: DeleteAction returns the *original* node in affectedNodes for rollback purposes
              // else if (action.type !== 'DELETE') { 
              //   // Track modifications (needs original data capture)
              // }
            });
          }

          if (actionResult.affectedEdges) {
            result.affectedEdges.push(...actionResult.affectedEdges);

            // Track created or modified edges for potential rollback
            actionResult.affectedEdges.forEach(edge => {
              edgeKey = `${edge.source}-${edge.label}-${edge.target}`;
              if (action.type === 'CREATE_RELATIONSHIP') {
                if (!createdEdgeKeys.includes(edgeKey)) createdEdgeKeys.push(edgeKey);
              }
              // Note: DeleteAction returns the *original* edge in affectedEdges for rollback purposes
              // else if (action.type !== 'DELETE') {
              //   // Track modifications (needs original data capture)
              // }
            });
          }
        }
      } catch (error: any) {
        // Unexpected error during execution
        const errorMsg = error.message || String(error);
        result.actionResults.push({
          success: false,
          error: errorMsg
        });
        result.success = false;
        result.error = `Error executing action: ${errorMsg}`;

        if (!execOptions.continueOnFailure) {
          break;
        }
      }
    }

    // Handle rollback if required
    if (!result.success && execOptions.rollbackOnFailure) {
      try {
        this.rollbackChanges(
          graph,
          bindings,
          originalBindings,
          createdNodeIds,
          createdEdgeKeys,
          modifiedNodesOriginalData, // Pass maps for modified items
          modifiedEdgesOriginalData,
          deletedNodes, // Pass arrays for deleted items
          deletedEdges
        );

        // Note: We don't change the result.success here because the action execution
        // still failed, even if the rollback was successful.
        result.error = `${result.error} (Changes rolled back)`;
      } catch (rollbackError: any) {
        result.error = `${result.error} (Rollback failed: ${rollbackError.message || String(rollbackError)})`;
      }
    }

    return result;
  }

  /**
   * Rolls back changes made during action execution
   * 
   * @private
   */
  private rollbackChanges(
    graph: Graph<NodeData, EdgeData>,
    bindings: BindingContext<NodeData, EdgeData>,
    originalBindings: Map<string, any>,
    createdNodeIds: NodeId[],
    createdEdgeKeys: string[],
    modifiedNodesOriginalData: Map<NodeId, NodeData>,
    modifiedEdgesOriginalData: Map<string, EdgeData>,
    deletedNodes: Node<NodeData>[], // Added
    deletedEdges: Edge<EdgeData>[]  // Added
  ): void {
    // Restore original bindings first (might be needed for re-adding)
    originalBindings.forEach((value, key) => {
      bindings.set(key, value);
    });

    // 1. Restore modified edges (if original data was captured)
    modifiedEdgesOriginalData.forEach((originalData, key) => {
      const [source, label, target] = key.split('-'); // Assuming key format
      try {
        graph.updateEdge(source, target, label, originalData);
      } catch (error) {
        console.warn(`Failed to rollback modified edge: ${key}`, error);
      }
    });

    // 2. Restore modified nodes (if original data was captured)
    modifiedNodesOriginalData.forEach((originalData, nodeId) => {
      try {
        graph.updateNodeData(nodeId, originalData);
      } catch (error) {
        console.warn(`Failed to rollback modified node: ${nodeId}`, error);
      }
    });

    // 3. Re-add deleted edges
    for (const edge of deletedEdges) {
      try {
        graph.addEdge(edge.source, edge.target, edge.label, edge.data);
      } catch (error) {
        console.warn(`Failed to rollback deleted edge: ${edge.source}-${edge.label}-${edge.target}`, error);
      }
    }

    // 4. Re-add deleted nodes
    for (const node of deletedNodes) {
      try {
        // Ensure node doesn't exist before re-adding (might happen if DETACH failed partially)
        if (!graph.hasNode(node.id)) {
          graph.addNode(node.id, node.label, node.data);
        }
      } catch (error) {
        console.warn(`Failed to rollback deleted node: ${node.id}`, error);
      }
    }

    // 5. Delete created relationships
    for (const key of createdEdgeKeys) {
      const [source, label, target] = key.split('-'); // Assuming key format
      try {
        graph.removeEdge(source, target, label);
      } catch (error) {
        console.warn(`Failed to rollback created edge: ${key}`, error);
      }
    }

    // 6. Delete created nodes
    for (const nodeId of createdNodeIds) {
      try {
        // Ensure node exists before removing (might have failed creation)
        if (graph.hasNode(nodeId)) {
          // Check if detach is needed (simple version: remove incident edges first)
          const incidentEdges = graph.getEdgesForNode(nodeId, 'both');
          for (const edge of incidentEdges) {
            graph.removeEdge(edge.source, edge.target, edge.label);
          }
          graph.removeNode(nodeId);
        }
      } catch (error) {
        console.warn(`Failed to rollback created node: ${nodeId}`, error);
      }
    }

    // Note: Rollback for modified items is still basic. A full transaction system
    // or more detailed state capture would be needed for perfect rollback.
    console.warn('Rollback for modified nodes and edges might be incomplete.');
  }
}