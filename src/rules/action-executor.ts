import { Graph, Node, Edge } from '@/graph';
import { RuleAction, ActionResult, ActionExecutionResult, ActionExecutionOptions } from './rule-action';

/**
 * Default options for action execution
 */
const DEFAULT_EXECUTION_OPTIONS: ActionExecutionOptions = {
  rollbackOnFailure: true,
  validateBeforeExecute: true
};

/**
 * Implementation of the ActionExecutor interface
 */
export class ActionExecutor<NodeData = any, EdgeData = any> {
  /**
   * Executes a list of actions with rollback on failure
   */
  executeActions(
    graph: Graph<NodeData, EdgeData>,
    actions: RuleAction<NodeData, EdgeData>[],
    bindings: any,
    options: ActionExecutionOptions = DEFAULT_EXECUTION_OPTIONS
  ): ActionExecutionResult<NodeData, EdgeData> {
    const { rollbackOnFailure, validateBeforeExecute } = options;
    const actionResults: ActionResult<NodeData, EdgeData>[] = [];

    try {
      for (const action of actions) {
        if (validateBeforeExecute) {
          const validation = action.validate(graph, bindings);
          if (!validation.valid) {
            actionResults.push({ success: false, error: validation.error });
            throw new Error(`Validation failed for action: ${action.describe()}`);
          }
        }

        const result = action.execute(graph, bindings);
        actionResults.push(result);

        if (!result.success) {
          throw new Error(`Execution failed for action ${action.describe()}: ${result.error}`);
        }
      }

      return {
        success: true,
        actionResults,
        affectedNodes: this.collectAffectedNodes(actionResults),
        affectedEdges: this.collectAffectedEdges(actionResults),
      };
    } catch (error) {
      if (rollbackOnFailure) {
        this.rollbackActions(graph, actions, actionResults);
      }

      return {
        success: false,
        actionResults,
        affectedNodes: [],
        affectedEdges: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Rolls back the changes made by executed actions using the actions and their results
   */
  private rollbackActions(
    graph: Graph<NodeData, EdgeData>,
    actions: RuleAction<NodeData, EdgeData>[],
    actionResults: ActionResult<NodeData, EdgeData>[]
  ): void {
    for (let i = actionResults.length - 1; i >= 0; i--) {
      const result = actionResults[i];
      const action = actions[i];

      if (result.success) {
        // Handle rollback based on the action type
        if (action.type === 'CREATE_NODE') {
          // For CREATE actions, remove the created nodes and edges
          if (result.affectedNodes) {
            for (const node of result.affectedNodes) {
              graph.removeNode(node.id);
            }
          }
        } else if (action.type === 'CREATE_RELATIONSHIP') {
          if (result.affectedEdges) {
            for (const edge of result.affectedEdges) {
              graph.removeEdge(edge.source, edge.target, edge.label);
            }
          }
        } else if (action.type === 'SET') {
          // For SET actions, revert the property changes (not implemented yet)
          // This would require tracking the previous property values in the ActionResult
        } else if (action.type === 'DELETE') {
          // For DELETE actions, restore the deleted nodes and edges
          if (result.affectedNodes) {
            for (const node of result.affectedNodes) {
              graph.addNode(node.id, node.label, node.data);
            }
          }
          if (result.affectedEdges) {
            for (const edge of result.affectedEdges) {
              graph.addEdge(edge.source, edge.target, edge.label, edge.data);
            }
          }
        }
      }
    }
  }

  /**
   * Collects all affected nodes from the action results
   */
  private collectAffectedNodes(
    actionResults: ActionResult<NodeData, EdgeData>[]
  ): Node<NodeData>[] {
    const nodes: Node<NodeData>[] = [];
    for (const result of actionResults) {
      if (result.success && result.affectedNodes) {
        nodes.push(...result.affectedNodes);
      }
    }
    return nodes;
  }

  /**
   * Collects all affected edges from the action results
   */
  private collectAffectedEdges(
    actionResults: ActionResult<NodeData, EdgeData>[]
  ): Edge<EdgeData>[] {
    const edges: Edge<EdgeData>[] = [];
    for (const result of actionResults) {
      if (result.success && result.affectedEdges) {
        edges.push(...result.affectedEdges);
      }
    }
    return edges;
  }
}