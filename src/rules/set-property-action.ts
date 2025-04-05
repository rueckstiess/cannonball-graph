import { Graph, Node, Edge } from '@/graph';
import { BindingContext } from '@/lang/condition-evaluator';
import { RuleAction, SetPropertyAction as ISetPropertyAction, ActionResult } from './rule-action';

/**
 * Implementation of the SetPropertyAction interface
 */
export class SetPropertyAction<NodeData = any, EdgeData = any>
  implements ISetPropertyAction<NodeData, EdgeData> {
  
  readonly type = 'SET_PROPERTY';

  /**
   * Creates a new SetPropertyAction
   * 
   * @param targetVariable The variable name of the target (node or relationship)
   * @param propertyName The name of the property to set
   * @param value The value to set
   */
  constructor(
    public targetVariable: string,
    public propertyName: string,
    public value: any
  ) {}

  /**
   * Validates that the action can be executed
   */
  validate(
    graph: Graph<NodeData, EdgeData>,
    bindings: BindingContext<NodeData, EdgeData>
  ): { valid: boolean; error?: string } {
    // Check if target exists in bindings
    if (!bindings.has(this.targetVariable)) {
      return {
        valid: false,
        error: `Target ${this.targetVariable} not found in bindings`
      };
    }

    // Property name should be a string and not empty
    if (typeof this.propertyName !== 'string' || this.propertyName.trim() === '') {
      return {
        valid: false,
        error: 'Property name must be a non-empty string'
      };
    }

    // Get the target object
    const target = bindings.get(this.targetVariable);
    
    // Check if target is a node or edge
    if (!target || 
        (typeof target !== 'object') || 
        (!('id' in target) && !('source' in target && 'target' in target))) {
      return {
        valid: false,
        error: `Target ${this.targetVariable} is not a valid node or relationship`
      };
    }

    return { valid: true };
  }

  /**
   * Executes the property setting action
   */
  execute(
    graph: Graph<NodeData, EdgeData>,
    bindings: BindingContext<NodeData, EdgeData>
  ): ActionResult<NodeData, EdgeData> {
    // Validate first
    const validation = this.validate(graph, bindings);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    try {
      const target = bindings.get(this.targetVariable);
      
      // Determine if target is a node or relationship
      const isNode = 'id' in target && !('source' in target && 'target' in target);
      
      if (isNode) {
        // Handle node property update
        const node = target as Node<NodeData>;
        
        // Copy the existing data
        const updatedData = {
          ...(node.data || {}),
          [this.propertyName]: this.value
        } as NodeData;
        
        // Update the node in the graph
        const updateSuccess = graph.updateNode(node.id, updatedData);
        
        if (!updateSuccess) {
          return {
            success: false,
            error: `Failed to update node ${node.id}`
          };
        }
        
        // Get the updated node
        const updatedNode = graph.getNode(node.id);
        if (!updatedNode) {
          return {
            success: false,
            error: `Node was updated but could not be retrieved`
          };
        }
        
        // Update the binding
        bindings.set(this.targetVariable, updatedNode);
        
        return {
          success: true,
          affectedNodes: [updatedNode]
        };
      } else {
        // Handle relationship property update
        const edge = target as Edge<EdgeData>;
        
        // Copy the existing data
        const updatedData = {
          ...(edge.data || {}),
          [this.propertyName]: this.value
        } as EdgeData;
        
        // Update the edge in the graph
        const updateSuccess = graph.updateEdge(edge.source, edge.target, edge.label, updatedData);
        
        if (!updateSuccess) {
          return {
            success: false,
            error: `Failed to update relationship from ${edge.source} to ${edge.target}`
          };
        }
        
        // Get the updated edge
        const updatedEdge = graph.getEdge(edge.source, edge.target, edge.label);
        if (!updatedEdge) {
          return {
            success: false,
            error: `Relationship was updated but could not be retrieved`
          };
        }
        
        // Update the binding
        bindings.set(this.targetVariable, updatedEdge);
        
        return {
          success: true,
          affectedEdges: [updatedEdge]
        };
      }
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
    // Format the value based on its type
    let formattedValue;
    if (typeof this.value === 'string') {
      formattedValue = `"${this.value}"`;
    } else if (this.value === null) {
      formattedValue = 'null';
    } else if (typeof this.value === 'object') {
      formattedValue = JSON.stringify(this.value);
    } else {
      formattedValue = String(this.value);
    }
    
    return `SET ${this.targetVariable}.${this.propertyName} = ${formattedValue}`;
  }
}