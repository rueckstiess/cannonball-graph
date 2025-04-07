import { QueryEngine } from './query-engine';
import { QueryFormatter } from './query-formatter';
import { QueryUtils } from './query-utils';
import { ActionFactory, ActionExecutor } from './rule-action';


// Export interfaces
export * from './rule-action';

// Re-export rule engine types
export * from './query-engine';

// Export query-related types and classes
export * from './query-formatter';
export * from './query-utils';


/**
 * Creates a new action factory for converting AST nodes to executable actions.
 * 
 * @returns A new ActionFactory instance
 * 
 * @example
 * ```typescript
 * import { createActionFactory } from '@/rules';
 * 
 * const factory = createActionFactory();
 * const actions = factory.createActionsFromRuleAst(ruleAst);
 * ```
 */
export function createActionFactory<NodeData = any, EdgeData = any>() {
  return new ActionFactory<NodeData, EdgeData>();
}

/**
 * Creates a new action executor for applying graph transformations.
 * 
 * @returns A new ActionExecutor instance
 * 
 * @example
 * ```typescript
 * import { createActionExecutor, createBindingContext } from '@/rules';
 * 
 * const executor = createActionExecutor();
 * const bindings = createBindingContext();
 * 
 * // Add matched nodes to bindings
 * bindings.set('n', matchedNode);
 * 
 * const result = executor.executeActions(graph, actions, bindings, {
 *   rollbackOnFailure: true
 * });
 * ```
 */
export function createActionExecutor<NodeData = any, EdgeData = any>() {
  return new ActionExecutor<NodeData, EdgeData>();
}

/**
 * Creates a new rule engine for end-to-end rule execution.
 * The rule engine integrates all components of the rule system.
 * 
 * @returns A new QueryEngine instance
 * 
 * @example
 * ```typescript
 * import { createQueryEngine } from '@/rules';
 * 
 * const engine = createQueryEngine();
 * 
 * const result = engine.executeQuery(graph, 'MATCH (n:Person) RETURN n.name');
 * 
 * // Execute a graph statement that both modifies and returns data
 * const result = engine.executeQuery(graph, `
 *   MATCH (n:Person)
 *   WHERE n.age > 30
 *   CREATE (t:Task {name: 'New Task', assignedTo: n.name})
 *   RETURN n.name, t.name
 * `);
 * 
 * // Access query results if present
 * if (result.query) {
 *   console.log(`Columns: ${result.query.columns.join(', ')}`);
 *   console.log(`Rows: ${result.query.rows.length}`);
 * }
 * 
 * // Access action results if present
 * if (result.actions) {
 *   console.log(`Nodes created: ${result.actions.affectedNodes.length}`);
 *   console.log(`Edges created: ${result.actions.affectedEdges.length}`);
 * }
 * 
 * // Execute multiple queries in order (higher priority first)
 * const queries = [
 *   { statement: 'MATCH (n:Person) SET n.active = true', priority: 10 },
 *   { statement: 'MATCH (n:Person) RETURN n.name, n.active', priority: 5 }
 * ];
 * const results = engine.executeQueries(graph, queries);
 * ```
 */
export function createQueryEngine<NodeData = any, EdgeData = any>() {
  return new QueryEngine<NodeData, EdgeData>();
}

/**
 * Creates a new query formatter for formatting query results.
 * 
 * @returns A new QueryFormatter instance
 * 
 * @example
 * ```typescript
 * import { createQueryEngine, createQueryFormatter } from '@/rules';
 * 
 * const engine = createQueryEngine();
 * const formatter = createQueryFormatter();
 * 
 * // Execute a query
 * const result = engine.executeQuery(graph, 'MATCH (n:Person) RETURN n.name');
 * 
 * // Format the results as a markdown table
 * const markdownTable = formatter.toMarkdownTable(result);
 * 
 * // Format the results as a JSON string
 * const json = formatter.toJson(result);
 * 
 * // Format the results as a plain text table
 * const textTable = formatter.toTextTable(result);
 * ```
 */
export function createQueryFormatter<NodeData = any, EdgeData = any>() {
  return new QueryFormatter<NodeData, EdgeData>();
}

/**
 * Creates a new query utils object for working with query results.
 * 
 * @returns A new QueryUtils instance
 * 
 * @example
 * ```typescript
 * import { createQueryEngine, createQueryUtils } from '@/rules';
 * 
 * const engine = createQueryEngine();
 * const utils = createQueryUtils();
 * 
 * // Execute a query
 * const result = engine.executeQuery(graph, 'MATCH (n:Person) RETURN n.name, n.age');
 * 
 * // Extract specific columns
 * const names = utils.extractColumn(result, 'n.name');
 * 
 * // Convert to an array of objects
 * const people = utils.toObjectArray(result);
 * 
 * // Create a subgraph from the query results
 * const subgraph = utils.toSubgraph(result);
 * ```
 */
export function createQueryUtils<NodeData = any, EdgeData = any>() {
  return new QueryUtils<NodeData, EdgeData>();
}
