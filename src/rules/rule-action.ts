import { Graph, Node, Edge } from '@/graph';
import { BindingContext } from '@/lang/condition-evaluator';

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
export interface RuleAction<NodeData = any, EdgeData = any> {
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
export interface CreateNodeAction<NodeData = any, EdgeData = any> extends RuleAction<NodeData, EdgeData> {
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
export interface CreateRelationshipAction<NodeData = any, EdgeData = any> extends RuleAction<NodeData, EdgeData> {
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
export interface SetPropertyAction<NodeData = any, EdgeData = any> extends RuleAction<NodeData, EdgeData> {
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
    actions: RuleAction<NodeData, EdgeData>[],
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

  /**
   * Whether to continue executing remaining actions if one fails
   */
  continueOnFailure?: boolean;
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
   * Creates actions from a rule AST
   * 
   * @param ruleAst The AST of the rule
   * @returns A list of actions to execute
   */
  createActionsFromRuleAst(ruleAst: any): RuleAction<NodeData, EdgeData>[];
}
