import { Graph, Node, Edge } from '@/graph';
import { BindingContext } from '@/lang/condition-evaluator';
import { RuleAction, CreateRelationshipAction as ICreateRelationshipAction, ActionResult } from './rule-action';

/**
 * Implementation of the CreateRelationshipAction interface
 */
export class CreateRelationshipAction<NodeData = any, EdgeData = any> 
  implements ICreateRelationshipAction<NodeData, EdgeData> {
  
  readonly type = 'CREATE_RELATIONSHIP';

  /**
   * Creates a new CreateRelationshipAction
   * 
   * @param fromVariable The variable name of the source node
   * @param toVariable The variable name of the target node
   * @param relType The type of the relationship
   * @param properties Properties to set on the relationship
   * @param variable Optional variable name to bind the created relationship to
   */
  constructor(
    public fromVariable: string,
    public toVariable: string,
    public relType: string,
    public properties: Record<string, any>,
    public variable?: string
  ) {}

  /**
   * Validates that the action can be executed
   */
  validate(
    graph: Graph<NodeData, EdgeData>,
    bindings: BindingContext<NodeData, EdgeData>
  ): { valid: boolean; error?: string } {
    // Check if source node exists in bindings
    if (!bindings.has(this.fromVariable)) {
      return {
        valid: false,
        error: `Source node ${this.fromVariable} not found in bindings`
      };
    }

    // Check if target node exists in bindings
    if (!bindings.has(this.toVariable)) {
      return {
        valid: false,
        error: `Target node ${this.toVariable} not found in bindings`
      };
    }

    // Check if relationship variable already exists (if specified)
    if (this.variable && bindings.has(this.variable)) {
      return {
        valid: false,
        error: `Relationship variable ${this.variable} already exists in bindings`
      };
    }

    // Relationship type should be a string and not empty
    if (typeof this.relType !== 'string' || this.relType.trim() === '') {
      return {
        valid: false,
        error: 'Relationship type must be a non-empty string'
      };
    }

    return { valid: true };
  }

  /**
   * Executes the relationship creation action
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
      // Get source and target nodes from bindings
      const sourceNode = bindings.get(this.fromVariable) as Node<NodeData>;
      const targetNode = bindings.get(this.toVariable) as Node<NodeData>;

      // Create the relationship
      try {
        graph.addEdge(
          sourceNode.id,
          targetNode.id,
          this.relType,
          this.properties as EdgeData
        );
      } catch (error) {
        return {
          success: false,
          error: `Failed to add relationship: ${error}`
        };
      }

      // Get the created relationship
      const newEdge = graph.getEdge(sourceNode.id, targetNode.id, this.relType);
      if (!newEdge) {
        return {
          success: false,
          error: 'Relationship was added but could not be retrieved'
        };
      }

      // Bind the new relationship to the variable if specified
      if (this.variable) {
        bindings.set(this.variable, newEdge);
      }

      return {
        success: true,
        affectedEdges: [newEdge]
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
    const propsStr = Object.entries(this.properties)
      .map(([key, value]) => {
        // Format the value based on its type
        const formattedValue = typeof value === 'string'
          ? `"${value}"`
          : String(value);
          
        return `${key}: ${formattedValue}`;
      })
      .join(', ');
      
    const relVarStr = this.variable ? this.variable : '';
    
    return `CREATE (${this.fromVariable})-[${relVarStr}:${this.relType} {${propsStr}}]->(${this.toVariable})`;
  }
}