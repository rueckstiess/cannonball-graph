import { Graph, Node, Edge } from '@/graph';
import { BindingContext, ConditionEvaluator } from '@/lang/condition-evaluator';


import { CypherStatement, Expression } from '@/lang/parser';
import { NodePattern } from '@/lang/pattern-matcher';

/**
 * Represents the result of an action execution
 */
export interface ActionResult<NodeData = any, EdgeData = any> {
  /**
   * Whether the action execution was successful
   */
  success: boolean;

  /**
   * Error message if execution failed
   */
  error?: string;

  /**
   * Nodes created or modified by the action
   */
  affectedNodes?: Node<NodeData>[];

  /**
   * Edges created or modified by the action
   */
  affectedEdges?: Edge<EdgeData>[];
}

/**
 * Represents an action that can be executed on a graph
 */
export interface QueryAction<NodeData = any, EdgeData = any> {
  /**
   * The type of the action (CREATE_NODE, CREATE_RELATIONSHIP, SET_PROPERTY, etc.)
   */
  type: string;

  /**
   * 
   * @param graph The graph to validate against
   * @param bindings Variable bindings from pattern matching
   * @returns True if the action can be executed, false otherwise
   */
  validate(
    graph: Graph<NodeData, EdgeData>,
    bindings: BindingContext<NodeData, EdgeData>
  ): { valid: boolean; error?: string };

  /**
   * Executes the action on the given graph
   * 
   * @param graph The graph to execute on
   * @param bindings Variable bindings from pattern matching
   * @returns The result of the action execution
   */
  execute(
    graph: Graph<NodeData, EdgeData>,
    bindings: BindingContext<NodeData, EdgeData>
  ): ActionResult<NodeData, EdgeData>;

  /**
   * Provides a description of the action for logging and debugging
   */
  describe(): string;
}


/**
 * Options for action execution
 */
export interface ActionExecutionOptions {
  /**
   * Whether to attempt a rollback on failure
   */
  rollbackOnFailure?: boolean;

  /**
   * Whether to validate all actions before executing any
   */
  validateBeforeExecute?: boolean;
}

/**
 * Default options for action execution
 */
const DEFAULT_EXECUTION_OPTIONS: ActionExecutionOptions = {
  rollbackOnFailure: true,
  validateBeforeExecute: true
};


/**
 * Result of executing multiple actions
 */
export interface ActionExecutionResult<NodeData = any, EdgeData = any> {
  /**
   * Whether the execution was successful overall
   */
  success: boolean;

  /**
   * Results from individual actions
   */
  actionResults: ActionResult<NodeData, EdgeData>[];

  /**
   * Nodes affected by all actions
   */
  affectedNodes: Node<NodeData>[];

  /**
   * Edges affected by all actions
   */
  affectedEdges: Edge<EdgeData>[];

  /**
   * Error message if execution failed
   */
  error?: string;
}




/**
 * Implementation of the CreateNodeAction interface
 */
export class CreateNodeAction<NodeData = any, EdgeData = any> implements QueryAction<NodeData, EdgeData> {
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

    // Don't allow empty labels
    if (this.labels.length === 0) {
      return {
        valid: false,
        error: 'label is required'
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



/**
 * Represents an action that creates a relationship between two nodes
 */


/**
 * Implementation of the CreateRelationshipAction interface
 */
export class CreateRelationshipAction<NodeData = any, EdgeData = any> {

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
  ) { }

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




/**
 * Represents an action that sets a property on a node or relationship
 */

export class SetPropertyAction<NodeData = any, EdgeData = any> {

  readonly type = 'SET_PROPERTY';
  private conditionEvaluator: ConditionEvaluator<NodeData, EdgeData>;

  /**
   * Creates a new SetPropertyAction
   * 
   * @param targetVariable The variable name of the target (node or relationship)
   * @param propertyName The name of the property to set
   * @param expression The value to set
   */
  constructor(
    public targetVariable: string,
    public propertyName: string,
    public expression: Expression,
  ) {
    this.conditionEvaluator = new ConditionEvaluator<NodeData, EdgeData>();
  }

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
          [this.propertyName]: this.conditionEvaluator.evaluateExpression(graph, this.expression, bindings)
        } as NodeData;

        // Update the node in the graph
        const updateSuccess = graph.updateNodeData(node.id, updatedData);

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
          [this.propertyName]: this.conditionEvaluator.evaluateExpression(graph, this.expression, bindings)
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
    if (typeof this.expression === 'string') {
      formattedValue = `"${this.expression}"`;
    } else if (this.expression === null) {
      formattedValue = 'null';
    } else if (typeof this.expression === 'object') {
      formattedValue = JSON.stringify(this.expression);
    } else {
      formattedValue = String(this.expression);
    }

    return `SET ${this.targetVariable}.${this.propertyName} = ${formattedValue}`;
  }
}




/**
 * Implementation of the DeleteAction
 */
export class DeleteAction<NodeData = any, EdgeData = any> {

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
          } else {
            // Detach: Remove all incident edges first
            const incidentEdges = graph.getEdgesForNode(node.id, 'both');
            for (const edge of incidentEdges) {
              affectedEdges.push({ ...edge }); // Track the edge before deletion
              graph.removeEdge(edge.source, edge.target, edge.label);
            }
          }

          // Proceed with node deletion
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



/**
 * Factory for creating query actions from a cypher statement
 */
export class ActionFactory<NodeData = any, EdgeData = any> {

  private getOrSetNodeVar(node: NodePattern): string {
    if (node.variable) {
      return node.variable;
    } else {
      return '_anonymous_' + Math.random().toString(36).substring(2, 10);
    }
  }

  /**
   * Creates actions from a Cypher statement
   * 
   * @param statement The Cypher statement 
   * @returns A list of actions to execute
   */
  createActionsFromCypherStatement(statement: CypherStatement): QueryAction<NodeData, EdgeData>[] {
    const actions: QueryAction<NodeData, EdgeData>[] = [];

    if (statement.create) {
      for (const pattern of statement.create.patterns) {
        if ('node' in pattern) {
          // Create a node action
          const nodeVar = this.getOrSetNodeVar(pattern.node);
          actions.push(new CreateNodeAction(
            nodeVar,
            pattern.node.labels,
            pattern.node.properties
          ));
        } else {
          // Create node and relationship actions
          const fromVar = this.getOrSetNodeVar(pattern.fromNode.node);
          const toVar = this.getOrSetNodeVar(pattern.toNode.node);

          if (pattern.fromNode.node.labels.length > 0) {
            // this node pattern does not refer to a bound variable, create it
            actions.push(new CreateNodeAction(
              fromVar,
              pattern.fromNode.node.labels,
              pattern.fromNode.node.properties
            ));
          }
          if (pattern.toNode.node.labels.length > 0) {
            // this node pattern does not refer to a bound variable, create it
            actions.push(new CreateNodeAction(
              toVar,
              pattern.toNode.node.labels,
              pattern.toNode.node.properties
            ));
          }
          if (pattern.relationship.type) {
            // this relationship pattern does not refer to a bound variable, create it
            actions.push(new CreateRelationshipAction(
              fromVar,
              toVar,
              pattern.relationship.type || '',
              pattern.relationship.properties,
              pattern.relationship.variable
            ));
          }
        }
      }
    }

    if (statement.set) {
      for (const setting of statement.set.settings) {
        actions.push(new SetPropertyAction(
          setting.target.name,
          setting.property,
          setting.value
        ));
      }
    }

    if (statement.delete) {
      console.log('delete', statement.delete);
      for (const variable of statement.delete.variables) {
        actions.push(new DeleteAction(
          [variable.name],
          statement.delete.detach || false
        ));
      }
    }

    return actions;
  }
}


/**
 * Orchestrates the execution of multiple actions with transaction-like semantics
 */

export class ActionExecutor<NodeData = any, EdgeData = any> {

  private conditionEvaluator: ConditionEvaluator<NodeData, EdgeData>;

  constructor() {
    this.conditionEvaluator = new ConditionEvaluator<NodeData, EdgeData>();
  }

  /**
   * Executes a list of actions with rollback on failure
   */
  executeActions(
    graph: Graph<NodeData, EdgeData>,
    actions: QueryAction<NodeData, EdgeData>[],
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
            throw new Error(`Validation failed for action ${action.describe()}: ${validation.error}`);
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
    actions: QueryAction<NodeData, EdgeData>[],
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
    // Use a map with node ID as key to eliminate duplicates
    const uniqueNodes = new Map<string, Node<NodeData>>();

    for (const result of actionResults) {
      if (result.success && result.affectedNodes) {
        for (const node of result.affectedNodes) {
          // Only add the node if it doesn't already exist in the map
          uniqueNodes.set(node.id, node);
        }
      }
    }

    // Convert the map values back to an array
    return Array.from(uniqueNodes.values());
  }

  /**
   * Collects all affected edges from the action results
   */
  private collectAffectedEdges(
    actionResults: ActionResult<NodeData, EdgeData>[]
  ): Edge<EdgeData>[] {
    // Use a map with composite key (source-label-target) to eliminate duplicates
    const uniqueEdges = new Map<string, Edge<EdgeData>>();

    for (const result of actionResults) {
      if (result.success && result.affectedEdges) {
        for (const edge of result.affectedEdges) {
          // Create a composite key from source-label-target
          const key = `${edge.source}-${edge.label}-${edge.target}`;
          // Only add the edge if it doesn't already exist in the map
          uniqueEdges.set(key, edge);
        }
      }
    }

    // Convert the map values back to an array
    return Array.from(uniqueEdges.values());
  }
}
