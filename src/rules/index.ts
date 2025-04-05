import { ActionFactory, ActionExecutor } from './rule-action-index';
import { RuleEngine } from './rule-engine';

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
 * @returns A new RuleEngine instance
 * 
 * @example
 * ```typescript
 * import { createRuleEngine } from '@/rules';
 * 
 * const engine = createRuleEngine();
 * 
 * // Execute a single rule
 * const result = engine.executeRule(graph, rule);
 * 
 * // Execute multiple rules in priority order
 * const results = engine.executeRules(graph, rules);
 * 
 * // Parse and execute rules from markdown
 * const results = engine.executeRulesFromMarkdown(graph, markdownText);
 * ```
 */
export function createRuleEngine<NodeData = any, EdgeData = any>() {
  return new RuleEngine<NodeData, EdgeData>();
}

// Re-export action-related types and classes
export * from './rule-action-index';

// Re-export rule engine types
export * from './rule-engine';