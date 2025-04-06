import { Graph, Node, Edge, NodeId } from '@/graph';
import { BindingContext } from '@/lang/condition-evaluator';
import { RuleAction, DeleteAction as IDeleteAction, ActionResult } from './rule-action';

/**
 * Implementation of the DeleteAction interface
 */
export class DeleteAction<NodeData = any, EdgeData = any>
  implements IDeleteAction<NodeData, EdgeData> {

  readonly type = 'DELETE';

  /**
   * Creates a new DeleteAction
   *
   * @param variableNames The variable names of the nodes or relationships to delete
   * @param detach Whether to detach nodes before deleting
   */
  constructor(
    public variableNames: string[],
    public detach: boolean
  ) { }

  /**
   * Validates that the action can be executed
   */
  validate(
    graph: Graph<NodeData, EdgeData>,
    bindings: BindingContext<NodeData, EdgeData>
  ): { valid: boolean; error?: string } {
    for (const varName of this.variableNames) {
      if (!bindings.has(varName)) {
        return {
          valid: false,
          error: `Variable '${varName}' to delete not found in bindings`
        };
      }
      const item = bindings.get(varName);
      if (!item || (typeof item !== 'object') || (!('id' in item) && !('source' in item && 'target' in item))) {
        return {
          valid: false,
          error: `Variable '${varName}' does not refer to a valid node or relationship`
        };
      }
    }
    return { valid: true };
  }

  /**
   * Executes the delete action
   */
  execute(
    graph: Graph<NodeData, EdgeData>,
    bindings: BindingContext<NodeData, EdgeData>
  ): ActionResult<NodeData, EdgeData> {
    const validation = this.validate(graph, bindings);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const affectedNodes: Node<NodeData>[] = []; // Store original nodes before deletion
    const affectedEdges: Edge<EdgeData>[] = []; // Store original edges before deletion

    try {
      for (const varName of this.variableNames) {
        const item = bindings.get(varName);

        // Check if it's a node
        if ('id' in item && !('source' in item)) {
          const node = item as Node<NodeData>;

          if (!this.detach) {
            // Check if the node has any relationships
            const incidentEdges = graph.getEdgesForNode(node.id, 'both');
            if (incidentEdges.length > 0) {
              return {
                success: false,
                error: `Cannot delete node '${varName}' (ID: ${node.id}) because it still has relationships. Use DETACH DELETE to delete relationships first.`
              };
            }
          }

          // Detach is true or no relationships exist, proceed with deletion
          affectedNodes.push({ ...node }); // Store a copy before deletion
          graph.removeNode(node.id);
          bindings.set(varName, undefined); // Remove from bindings
        }
        // Check if it's an edge
        else if ('source' in item && 'target' in item) {
          const edge = item as Edge<EdgeData>;
          affectedEdges.push({ ...edge }); // Store a copy
          graph.removeEdge(edge.source, edge.target, edge.label);
          bindings.set(varName, undefined); // Remove from bindings
        } else {
          // Should have been caught by validation, but good to have a fallback
          return {
            success: false,
            error: `Variable '${varName}' is not a node or relationship`
          };
        }
      }

      // Return copies of the deleted items
      return {
        success: true,
        affectedNodes,
        affectedEdges
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  }

  /**
   * Provides a human-readable description of the action
   */
  describe(): string {
    const prefix = this.detach ? 'DETACH DELETE' : 'DELETE';
    return `${prefix} ${this.variableNames.join(', ')}`;
  }
}
