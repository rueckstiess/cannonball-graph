import { Graph, Node, Edge } from '@/graph';
import { BindingContext, ConditionEvaluator } from '@/lang/condition-evaluator';
import {
  ASTQueryRoot,
  ASTCreateNodePatternNode,
  ASTCreateRelPatternNode,
  ASTPropertySettingNode,
  ASTDeleteNode
} from '@/lang/ast-transformer';

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
 * Represents an action that creates a new node
 */
export interface CreateNodeAction<NodeData = any, EdgeData = any> extends QueryAction<NodeData, EdgeData> {
  /**
   * The variable name to bind the created node to
   */
  variable: string;

  /**
   * Labels to assign to the node
   */
  labels: string[];

  /**
   * Properties to set on the node
   */
  properties: Record<string, any>;
}

/**
 * Represents an action that creates a relationship between two nodes
 */
export interface CreateRelationshipAction<NodeData = any, EdgeData = any> extends QueryAction<NodeData, EdgeData> {
  /**
   * The variable name of the source node
   */
  fromVariable: string;

  /**
   * The variable name of the target node
   */
  toVariable: string;

  /**
   * The type of the relationship
   */
  relType: string;

  /**
   * The variable name to bind the created relationship to (optional)
   */
  variable?: string;

  /**
   * Properties to set on the relationship
   */
  properties: Record<string, any>;
}

/**
 * Represents an action that sets a property on a node or relationship
 */
export interface SetPropertyAction<NodeData = any, EdgeData = any> extends QueryAction<NodeData, EdgeData> {
  /**
   * The variable name of the target (node or relationship)
   */
  targetVariable: string;

  /**
   * The name of the property to set
   */
  propertyName: string;

  /**
   * The value expression to evaluate and set
   */
  value: any;
}

/**
 * Represents an action that deletes a node or relationship
 */
export interface DeleteAction<NodeData = any, EdgeData = any> extends QueryAction<NodeData, EdgeData> {
  /**
   * The variable names of the nodes or relationships to delete
   */
  variableNames: string[];

  /**
   * Whether to detach nodes before deleting (DETACH DELETE)
   */
  detach: boolean;
}

/**
 * Orchestrates the execution of multiple actions with transaction-like semantics
 */
export interface ActionExecutor<NodeData = any, EdgeData = any> {
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
    actions: QueryAction<NodeData, EdgeData>[],
    bindings: BindingContext<NodeData, EdgeData>,
    options?: ActionExecutionOptions
  ): ActionExecutionResult<NodeData, EdgeData>;
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
 * Factory for creating rule actions from AST nodes
 */
export class ActionFactory<NodeData = any, EdgeData = any> {

  private conditionEvaluator: ConditionEvaluator<NodeData, EdgeData>;

  /**
   * Creates a new ActionFactory
   * 
   * @param conditionEvaluator Optional condition evaluator for evaluating expressions
   */
  constructor(conditionEvaluator?: ConditionEvaluator<NodeData, EdgeData>) {
    this.conditionEvaluator = conditionEvaluator || new ConditionEvaluator<NodeData, EdgeData>();
  }

  /**
   * Creates actions from a CREATE node AST node
   * 
   * @param createNodeAst The AST node representing a node creation
   * @returns The corresponding action
   */
  createNodeActionFromAst(
    createNodeAst: ASTCreateNodePatternNode
  ): CreateNodeAction<NodeData, EdgeData> {
    return new CreateNodeAction<NodeData, EdgeData>(
      createNodeAst.variable || '_anonymous_node_' + Math.random().toString(36).substring(2, 10),
      createNodeAst.labels,
      createNodeAst.properties
    );
  }

  /**
   * Creates actions from a CREATE relationship AST node
   * 
   * @param createRelAst The AST node representing a relationship creation
   * @returns The corresponding action
   */
  createRelationshipActionFromAst(
    createRelAst: ASTCreateRelPatternNode
  ): CreateRelationshipAction<NodeData, EdgeData> {
    return new CreateRelationshipAction<NodeData, EdgeData>(
      createRelAst.fromVar,
      createRelAst.toVar,
      createRelAst.relationship.relType || '_RELATED_TO_',
      createRelAst.relationship.properties || {},
      createRelAst.relationship.variable
    );
  }

  /**
   * Creates actions from a SET property AST node
   * 
   * @param setPropertyAst The AST node representing a property setting
   * @returns The corresponding action
   */
  setPropertyActionFromAst(
    setPropertyAst: ASTPropertySettingNode
  ): SetPropertyAction<NodeData, EdgeData> {
    // Extract the property value
    let value: any;

    // For literal expressions in the AST, extract the value directly
    if (setPropertyAst.value.type === 'literalExpression') {
      value = setPropertyAst.value.value;
    } else {
      // For more complex expressions, we might need a more sophisticated approach
      // This is a simplified version that assumes the value is already processed
      value = setPropertyAst.value;

      // In a more complete implementation, we would use the conditionEvaluator
      // to evaluate expressions dynamically at runtime
    }

    return new SetPropertyAction<NodeData, EdgeData>(
      setPropertyAst.target,
      setPropertyAst.property,
      value
    );
  }

  /**
   * Creates actions from a DELETE AST node
   * 
   * @param deleteAst The AST node representing a delete operation
   * @returns The corresponding action
   */
  createDeleteActionFromAst(
    deleteAst: ASTDeleteNode
  ): DeleteAction<NodeData, EdgeData> {
    return new DeleteAction<NodeData, EdgeData>(
      deleteAst.variables,
      deleteAst.detach
    );
  }

  /**
   * Creates actions from a rule AST
   * 
   * @param ruleAst The AST of the rule
   * @returns A list of actions to execute
   */
  createActionsFromRuleAst(
    ruleAst: ASTQueryRoot
  ): QueryAction<NodeData, EdgeData>[] {
    const actions: QueryAction<NodeData, EdgeData>[] = [];

    // Process each child node in the rule AST
    for (const node of ruleAst.children) {
      if (node.type === 'create') {
        // Process CREATE clause
        for (const createPattern of node.children) {
          if (createPattern.type === 'createNode') {
            actions.push(this.createNodeActionFromAst(createPattern));
          } else if (createPattern.type === 'createRelationship') {
            actions.push(this.createRelationshipActionFromAst(createPattern));
          }
        }
      } else if (node.type === 'set') {
        // Process SET clause
        for (const setPattern of node.children) {
          actions.push(this.setPropertyActionFromAst(setPattern));
        }
      } else if (node.type === 'delete') { // <-- Add handling for delete
        // Process DELETE clause
        actions.push(this.createDeleteActionFromAst(node));
      }
      // MATCH and WHERE clauses are handled earlier in the pattern matching phase
    }

    return actions;
  }
}

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
   * Validates that the action can be executed on the given graph
   *
   * @param graph The graph to validate against
   * @param bindings Variable bindings from pattern matching
   * @returns True if the action can be executed, false otherwise
   */
  validate(
    graph: Graph<NodeData, EdgeData>,
    bindings: BindingContext<NodeData, EdgeData>
  ): { valid: boolean; error?: string; };

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
 * Represents an action that creates a new node
 */


/**
 * Implementation of the CreateNodeAction interface
 */
export class CreateNodeAction<NodeData = any, EdgeData = any> {
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
  ) { }

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
 * Default options for action execution
 */
const DEFAULT_EXECUTION_OPTIONS: ActionExecutionOptions = {
  rollbackOnFailure: true,
  validateBeforeExecute: true
};

/**
 * Orchestrates the execution of multiple actions with transaction-like semantics
 */

export class ActionExecutor<NodeData = any, EdgeData = any> {
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
 * Factory for creating rule actions from AST nodes
 */

export interface ActionFactory<NodeData = any, EdgeData = any> {
  /**
   * Creates actions from a CREATE node AST node
   *
   * @param createNodeAst The AST node representing a node creation
   * @returns The corresponding action
   */
  createNodeActionFromAst(createNodeAst: any): CreateNodeAction<NodeData, EdgeData>;

  /**
   * Creates actions from a CREATE relationship AST node
   *
   * @param createRelAst The AST node representing a relationship creation
   * @returns The corresponding action
   */
  createRelationshipActionFromAst(createRelAst: any): CreateRelationshipAction<NodeData, EdgeData>;

  /**
   * Creates actions from a SET property AST node
   *
   * @param setPropertyAst The AST node representing a property setting
   * @returns The corresponding action
   */
  setPropertyActionFromAst(setPropertyAst: any): SetPropertyAction<NodeData, EdgeData>;

  /**
   * Creates actions from a DELETE AST node
   *
   * @param deleteAst The AST node representing a delete operation
   * @returns The corresponding action
   */
  createDeleteActionFromAst(deleteAst: any): DeleteAction<NodeData, EdgeData>;

  /**
   * Creates actions from a rule AST
   *
   * @param ruleAst The AST of the rule
   * @returns A list of actions to execute
   */
  createActionsFromRuleAst(ruleAst: any): QueryAction<NodeData, EdgeData>[];
}
