import { Graph, Node, Edge } from '@/graph';
import { CreateNodeAction } from './create-node-action';
import { CreateRelationshipAction } from './create-relationship-action';
import { BindingContext } from '@/lang/condition-evaluator';
import { 
  RuleAction, 
  ActionExecutor as IActionExecutor, 
  ActionExecutionOptions, 
  ActionExecutionResult,
  ActionResult
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
    const createdNodeIds: string[] = [];
    const createdEdgeIds: Array<[string, string, string]> = []; // source, target, label
    const modifiedNodeIds: string[] = [];
    const modifiedEdgeIds: Array<[string, string, string]> = []; // source, target, label
    
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
                createdNodeIds.push(node.id);
              } else {
                modifiedNodeIds.push(node.id);
              }
            });
          }
          
          if (actionResult.affectedEdges) {
            result.affectedEdges.push(...actionResult.affectedEdges);
            
            // Track created or modified edges for potential rollback
            actionResult.affectedEdges.forEach(edge => {
              if (action.type === 'CREATE_RELATIONSHIP') {
                createdEdgeIds.push([edge.source, edge.target, edge.label]);
              } else {
                modifiedEdgeIds.push([edge.source, edge.target, edge.label]);
              }
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
          createdEdgeIds,
          modifiedNodeIds,
          modifiedEdgeIds
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
    createdNodeIds: string[],
    createdEdgeIds: Array<[string, string, string]>,
    modifiedNodeIds: string[],
    modifiedEdgeIds: Array<[string, string, string]>
  ): void {
    // Restore original bindings
    originalBindings.forEach((value, key) => {
      bindings.set(key, value);
    });
    
    // 1. Delete created relationships (must be done before nodes to avoid orphaned edges)
    for (const [source, target, label] of createdEdgeIds) {
      try {
        graph.removeEdge(source, target, label);
      } catch (error) {
        console.warn(`Failed to rollback created edge: ${source} -[${label}]-> ${target}`, error);
      }
    }
    
    // 2. Delete created nodes
    for (const nodeId of createdNodeIds) {
      try {
        graph.removeNode(nodeId);
      } catch (error) {
        console.warn(`Failed to rollback created node: ${nodeId}`, error);
      }
    }
    
    // 3. Restore modified nodes
    // This requires us to have access to the original node data, which might
    // not be available in our current design. In a real implementation, we'd
    // need to capture original node/edge data before modifying.
    
    // Ideally, the graph would support transactions that can be rolled back.
    console.warn('Rollback for modified nodes and edges is not fully supported');
  }
}