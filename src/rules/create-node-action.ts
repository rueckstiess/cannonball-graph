import { Graph, Node, NodeId } from '@/graph';
import { BindingContext } from '@/lang/condition-evaluator';
import { RuleAction, CreateNodeAction as ICreateNodeAction, ActionResult } from './rule-action';

/**
 * Implementation of the CreateNodeAction interface
 */
export class CreateNodeAction<NodeData = any, EdgeData = any> implements ICreateNodeAction<NodeData, EdgeData> {
  readonly type = 'CREATE_NODE';

  /**
   * Creates a new CreateNodeAction
   * 
   * @param variable The variable name to bind the created node to
   * @param labels Labels to assign to the node
   * @param properties Properties to set on the node
   */
  constructor(
    public variable: string,
    public labels: string[],
    public properties: Record<string, any>
  ) { }

  /**
   * Validates that the action can be executed
   */
  validate(
    graph: Graph<NodeData, EdgeData>,
    bindings: BindingContext<NodeData, EdgeData>
  ): { valid: boolean; error?: string } {
    // Check if the variable already exists in bindings
    if (bindings.has(this.variable)) {
      return {
        valid: false,
        error: `Variable ${this.variable} already exists in bindings`
      };
    }

    // Labels should be strings
    for (const label of this.labels) {
      if (typeof label !== 'string') {
        return {
          valid: false,
          error: `Label must be a string, got ${typeof label}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Executes the node creation action
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
      // Create the node data object
      const nodeData = {
        ...this.properties,
      } as NodeData;

      // Generate a unique node ID
      const nodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Add the node to the graph
      try {
        graph.addNode(nodeId, this.labels[0], nodeData);
      } catch (error) {
        return {
          success: false,
          error: `Failed to add node: ${error}`
        };
      }

      // Get the created node
      const newNode = graph.getNode(nodeId);
      if (!newNode) {
        return {
          success: false,
          error: `Node was added but could not be retrieved`
        };
      }

      // Bind the new node to the variable
      bindings.set(this.variable, newNode);

      return {
        success: true,
        affectedNodes: [newNode]
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

    const labelsStr = this.labels.length > 0
      ? `:${this.labels.join(':')}`
      : '';

    return `CREATE (${this.variable}${labelsStr} {${propsStr}})`;
  }
}